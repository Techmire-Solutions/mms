import {
  buildHedgeValuationLines,
  buildReserveReclassificationLines,
  type HedgeRelationship,
  type HedgeValuationRecord,
} from "@mms/shared";
import { lockLedgerEvent } from "../ledgerPosting/ledgerEventLock.js";
import { assertHedgeAccountRole } from "./hedgeAccountRoles.js";
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
import { lookupClosingRate } from "./fxRevaluationUseCases.js";

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
  // The value is received or paid in cash: an Asset account, active and not a
  // summary row. `accountExists` alone let a Revenue account take the debit.
  await assertHedgeAccountRole(deps.store, actor.tenant, "cashAccountId", request.cashAccountId);
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
  // A discontinued hedge keeps its cumulative OCI reserve until the hedged cash
  // flows affect profit or loss (IFRS 9.6.5.6 + 6.5.11(d)), so it can be
  // reclassified exactly like a settled one.
  const anchor = [...hedge.valuations]
    .filter((record) => record.kind === "settlement" || record.kind === "discontinuation")
    .sort((left, right) => right.valuationDate.localeCompare(left.valuationDate))[0];
  if (
    (hedge.status !== "settled" && hedge.status !== "discontinued") ||
    hedge.hedgeType !== "cash_flow" ||
    !anchor ||
    !hedge.reserveAccountId
  ) {
    throw unprocessable(
      "Only a settled or discontinued cash flow hedge has a reserve to reclassify",
    );
  }
  if (request.date < anchor.valuationDate)
    throw unprocessable("Reclassify on or after the settlement or discontinuation date");
  // The reserve moves into the line item the hedged cash flows affect: P&L, never
  // an Asset or Equity account.
  await assertHedgeAccountRole(
    deps.store,
    actor.tenant,
    "reclassificationAccountId",
    request.targetAccountId,
  );
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
    rate: anchor.rate,
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

/**
 * Discontinue hedge accounting prospectively (IFRS 9.6.5.6).
 *
 * The cumulative fair value is recognised **without** the automatic next-day
 * reversal the periodic valuations use: the relationship stops qualifying, so the
 * fair value stays on the instrument account and the effective part stays in the OCI
 * reserve until it is reclassified. The state moves `active → discontinued`; a second
 * discontinuation, an earlier-date re-run or a valuation on/after the date is refused,
 * and settlement remains available only to an active hedge.
 */
export async function discontinueHedge(
  deps: HedgeDeps,
  actor: Actor,
  id: string,
  request: { date: string; reason: string },
): Promise<HedgeRelationship> {
  await lockLedgerEvent(actor.tenant, `hedge:${id}:discontinuation:${request.date}`);
  const hedge = await load(deps, actor.tenant, id);
  if (hedge.status !== "active") throw unprocessable("Only an active hedge can be discontinued");
  if (request.date < hedge.designationDate || request.date > hedge.maturityDate) {
    throw unprocessable("The discontinuation date must fall between designation and maturity");
  }
  if (hedge.valuations.some((record) => record.valuationDate >= request.date)) {
    throw unprocessable("Discontinue after the last valuation, settlement or reclassification");
  }
  const { functionalCurrency } = await deps.fx.getCurrencySettings(actor.tenant);
  const rate = await lookupClosingRate(
    deps.fx,
    actor.tenant,
    hedge.currency,
    functionalCurrency,
    request.date,
  );
  if (!rate) {
    throw unprocessable(
      `No CLOSING or SPOT rate for ${hedge.currency} on or before ${request.date}`,
    );
  }
  const valuation = valuationOrThrow(hedge, rate, functionalCurrency);
  const recordId = hedgeRecordId(id, "discontinuation", request.date);
  const record: HedgeValuationRecord = {
    valuationDate: request.date,
    kind: "discontinuation",
    ...valuation,
    entryId: null,
    reversalEntryId: null,
  };
  if (Number(valuation.instrumentValue) !== 0) {
    const lines = buildHedgeValuationLines(valuation, hedge, `Hedge discontinued ${hedge.name}`);
    const entry = await deps.buildEntry(
      actor.tenant,
      // Shares the hedge fair-value source type; the record id embeds the kind, so
      // the (source_type, source_id) idempotency key stays unique.
      "hedge_val",
      recordId,
      request.date,
      `Hedge discontinued ${hedge.name}`,
      lines,
    );
    record.entryId = (await deps.postEntry(actor.tenant, entry))?.id ?? entry.id;
  }
  const discontinued = await insertOnce(async () => {
    await deps.store.insertHedgeValuation(actor.tenant, id, recordId, record, actor.userId);
    await deps.store.updateHedgeStatus(actor.tenant, id, "discontinued", valuation.effective);
  });
  if (discontinued) {
    await audit(deps, actor, id, "UPDATE", { discontinuation: record, reason: request.reason });
  }
  return load(deps, actor.tenant, id);
}
