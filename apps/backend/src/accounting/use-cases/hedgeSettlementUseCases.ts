import {
  buildHedgeValuationLines,
  buildReserveReclassificationLines,
  type HedgeRelationship,
  type HedgeValuationRecord,
} from "@mms/shared";
import { lockLedgerEvent } from "../ledgerPosting/ledgerEventLock.js";
import {
  audit,
  hedgeRecordId,
  insertOnce,
  load,
  unprocessable,
  valuationOrThrow,
  type Actor,
  type HedgeDeps,
} from "./hedgeUseCases.js";

/**
 * Hedge settlement and reserve reclassification — split out of `hedgeUseCases.ts`
 * to keep that module inside the length ceiling. The main module re-exports both,
 * so callers keep one import.
 */

/**
 * Settle the forward in cash at `settlementRate`: the cash account takes the
 * fair value, the effective part stays in the reserve until reclassified, the
 * rest goes to P&L. Settlement must follow the last valuation, whose reversal
 * has then already cleared the derivative balance.
 */
export async function settleHedge(
  deps: HedgeDeps,
  actor: Actor,
  id: string,
  request: { settlementDate: string; settlementRate: string; cashAccountId: string },
): Promise<HedgeRelationship> {
  await lockLedgerEvent(actor.tenant, `hedge:${id}:settlement:${request.settlementDate}`);
  const hedge = await load(deps, actor.tenant, id);
  if (hedge.status !== "active") throw unprocessable("Only an active hedge can be settled");
  if (hedge.valuations.some((record) => record.valuationDate >= request.settlementDate)) {
    throw unprocessable("Settle after the last valuation date");
  }
  if (!(await deps.store.accountExists(actor.tenant, request.cashAccountId))) {
    throw unprocessable("The settlement cash account does not exist");
  }
  const { functionalCurrency } = await deps.fx.getCurrencySettings(actor.tenant);
  const valuation = valuationOrThrow(hedge, request.settlementRate, functionalCurrency);
  const recordId = hedgeRecordId(id, "settlement", request.settlementDate);
  const lines = buildHedgeValuationLines(
    valuation,
    { ...hedge, instrumentAccountId: request.cashAccountId },
    `Hedge settlement ${hedge.name}`,
  );
  let entryId: string | null = null;
  if (lines.length > 0) {
    const entry = await deps.buildEntry(
      actor.tenant,
      "hedge_settle",
      recordId,
      request.settlementDate,
      `Hedge settlement ${hedge.name}`,
      lines,
    );
    entryId = (await deps.postEntry(actor.tenant, entry))?.id ?? entry.id;
  }
  const record: HedgeValuationRecord = {
    valuationDate: request.settlementDate,
    kind: "settlement",
    ...valuation,
    entryId,
    reversalEntryId: null,
  };
  const settled = await insertOnce(async () => {
    await deps.store.insertHedgeValuation(actor.tenant, id, recordId, record, actor.userId);
    await deps.store.updateHedgeStatus(actor.tenant, id, "settled", valuation.effective);
  });
  if (settled) await audit(deps, actor, id, "UPDATE", { settlement: record });
  return load(deps, actor.tenant, id);
}

/** Move the settled cash flow hedge reserve into profit or loss (IFRS 9.6.5.11(d)(ii)). */
export async function reclassifyHedgeReserve(
  deps: HedgeDeps,
  actor: Actor,
  id: string,
  request: { date: string; targetAccountId: string },
): Promise<HedgeRelationship> {
  await lockLedgerEvent(actor.tenant, `hedge:${id}:reclassification:${request.date}`);
  const hedge = await load(deps, actor.tenant, id);
  const settlement = hedge.valuations.find((record) => record.kind === "settlement");
  if (
    hedge.status !== "settled" ||
    hedge.hedgeType !== "cash_flow" ||
    !settlement ||
    !hedge.reserveAccountId
  ) {
    throw unprocessable("Only a settled cash flow hedge has a reserve to reclassify");
  }
  if (request.date < settlement.valuationDate)
    throw unprocessable("Reclassify on or after the settlement date");
  if (!(await deps.store.accountExists(actor.tenant, request.targetAccountId))) {
    throw unprocessable("The target account does not exist");
  }
  const recordId = hedgeRecordId(id, "reclassification", request.date);
  const lines = buildReserveReclassificationLines(
    hedge.settledReserve,
    hedge.reserveAccountId,
    request.targetAccountId,
    `Reclassify hedge reserve ${hedge.name}`,
  );
  let entryId: string | null = null;
  if (lines.length > 0) {
    const entry = await deps.buildEntry(
      actor.tenant,
      "hedge_reclass",
      recordId,
      request.date,
      `Reclassify hedge reserve ${hedge.name}`,
      lines,
    );
    entryId = (await deps.postEntry(actor.tenant, entry))?.id ?? entry.id;
  }
  const record: HedgeValuationRecord = {
    valuationDate: request.date,
    kind: "reclassification",
    rate: settlement.rate,
    instrumentValue: "0",
    hedgedChange: "0",
    effective: hedge.settledReserve,
    ineffective: "0",
    entryId,
    reversalEntryId: null,
  };
  const reclassified = await insertOnce(async () => {
    await deps.store.insertHedgeValuation(actor.tenant, id, recordId, record, actor.userId);
    await deps.store.updateHedgeStatus(actor.tenant, id, "reclassified");
  });
  if (reclassified) await audit(deps, actor, id, "UPDATE", { reclassification: record });
  return load(deps, actor.tenant, id);
}
