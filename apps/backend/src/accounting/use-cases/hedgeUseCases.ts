import { randomUUID } from "node:crypto";
import {
  buildHedgeValuationLines,
  buildReserveReclassificationLines,
  buildReversalLines,
  computeHedgeValuation,
  type HedgeRelationship,
  type HedgeRelationshipCreate,
  type HedgeValuationRecord,
  type JournalEntry,
} from "@mms/shared";
import type { RecordModernAuditInput } from "../../services/auditTrailService.js";
import type { AccountingFxRepository } from "../repository/accountingFxRepository.js";
import type { AccountingHedgesStore } from "../repository/accountingHedgesRepositoryAdapter.js";
import { lookupClosingRate, nextCalendarDay } from "./fxRevaluationUseCases.js";

export type HedgeSourceType = "hedge_val" | "hedge_val_rev" | "hedge_settle" | "hedge_reclass";

export interface HedgeDeps {
  fx: Pick<AccountingFxRepository, "getCurrencySettings" | "lookupExchangeRate">;
  store: Omit<AccountingHedgesStore, "listFiscalYearsByWorkspace">;
  /** Idempotent per (source_type, source_id); null when it already exists. */
  postEntry: (tenant: string, entry: JournalEntry) => Promise<JournalEntry | null>;
  buildEntry: (
    tenant: string,
    sourceType: HedgeSourceType,
    sourceId: string,
    date: string,
    description: string,
    lines: JournalEntry["lines"],
  ) => Promise<JournalEntry>;
  recordAudit: (input: RecordModernAuditInput) => Promise<unknown>;
}

interface Actor {
  tenant: string;
  userId: string | null;
}

function unprocessable(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 422, type: "validation_error" });
}

function notFound(): Error {
  return Object.assign(new Error("Hedge relationship not found"), {
    statusCode: 404,
    type: "not_found",
  });
}

async function load(deps: HedgeDeps, tenant: string, id: string): Promise<HedgeRelationship> {
  const hedge = await deps.store.findHedgeRelationship(tenant, id);
  if (!hedge) throw notFound();
  return hedge;
}

async function audit(
  deps: HedgeDeps,
  actor: Actor,
  recordId: string,
  actionType: "CREATE" | "UPDATE",
  newState: unknown,
) {
  await deps.recordAudit({
    workspaceSubdomain: actor.tenant,
    tableName: "accounting_hedge_relationships",
    recordId,
    actionType,
    realUserId: actor.userId,
    newState,
  });
}

/** Designate a hedge relationship (IFRS 9.6.4.1): documented objective, instrument and accounts. */
export async function createHedgeRelationship(
  deps: HedgeDeps,
  actor: Actor,
  hedge: HedgeRelationshipCreate,
): Promise<HedgeRelationship> {
  const { functionalCurrency } = await deps.fx.getCurrencySettings(actor.tenant);
  if (hedge.currency === functionalCurrency)
    throw unprocessable("A hedged currency must differ from the functional currency");
  for (const accountId of [hedge.instrumentAccountId, hedge.reserveAccountId, hedge.pnlAccountId]) {
    if (accountId && !(await deps.store.accountExists(actor.tenant, accountId))) {
      throw unprocessable(`Account ${accountId} does not exist`);
    }
  }
  const id = `hedge-${randomUUID()}`;
  await deps.store.insertHedgeRelationship(actor.tenant, id, hedge, actor.userId);
  await audit(deps, actor, id, "CREATE", hedge);
  return load(deps, actor.tenant, id);
}

/** Fair value and OCI / P&L split at the closing rate on `date`, without posting. */
export async function previewHedgeValuation(
  deps: HedgeDeps,
  tenant: string,
  id: string,
  date: string,
): Promise<HedgeValuationRecord> {
  const hedge = await load(deps, tenant, id);
  if (hedge.status !== "active") throw unprocessable("Only an active hedge can be valued");
  if (date < hedge.designationDate || date > hedge.maturityDate) {
    throw unprocessable("The valuation date must fall between designation and maturity");
  }
  const { functionalCurrency } = await deps.fx.getCurrencySettings(tenant);
  const rate = await lookupClosingRate(deps.fx, tenant, hedge.currency, functionalCurrency, date);
  if (!rate)
    throw unprocessable(`No CLOSING or SPOT rate for ${hedge.currency} on or before ${date}`);
  return {
    valuationDate: date,
    kind: "valuation",
    ...computeHedgeValuation(hedge, rate, functionalCurrency),
    entryId: null,
    reversalEntryId: null,
  };
}

/** Post the valuation with an automatic next-day reversal; one valuation per hedge and date. */
export async function postHedgeValuation(
  deps: HedgeDeps,
  actor: Actor,
  id: string,
  date: string,
): Promise<HedgeRelationship> {
  const existing = await load(deps, actor.tenant, id);
  if (
    existing.valuations.some(
      (record) => record.kind === "valuation" && record.valuationDate === date,
    )
  ) {
    return existing;
  }
  const preview = await previewHedgeValuation(deps, actor.tenant, id, date);
  const recordId = `hv-${randomUUID()}`;
  const record = { ...preview };
  if (Number(preview.instrumentValue) !== 0) {
    const lines = buildHedgeValuationLines(
      preview,
      existing,
      `Hedge valuation ${existing.name} ${date}`,
    );
    const entry = await deps.buildEntry(
      actor.tenant,
      "hedge_val",
      recordId,
      date,
      `Hedge valuation ${existing.name}`,
      lines,
    );
    const reversal = await deps.buildEntry(
      actor.tenant,
      "hedge_val_rev",
      recordId,
      nextCalendarDay(date),
      `Reverse hedge valuation ${existing.name} ${date}`,
      buildReversalLines(lines),
    );
    record.entryId = (await deps.postEntry(actor.tenant, entry))?.id ?? entry.id;
    record.reversalEntryId = (await deps.postEntry(actor.tenant, reversal))?.id ?? reversal.id;
  }
  await deps.store.insertHedgeValuation(actor.tenant, id, recordId, record, actor.userId);
  await audit(deps, actor, id, "UPDATE", { valuation: record });
  return load(deps, actor.tenant, id);
}

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
  const hedge = await load(deps, actor.tenant, id);
  if (hedge.status !== "active") throw unprocessable("Only an active hedge can be settled");
  if (hedge.valuations.some((record) => record.valuationDate >= request.settlementDate)) {
    throw unprocessable("Settle after the last valuation date");
  }
  if (!(await deps.store.accountExists(actor.tenant, request.cashAccountId))) {
    throw unprocessable("The settlement cash account does not exist");
  }
  const { functionalCurrency } = await deps.fx.getCurrencySettings(actor.tenant);
  const valuation = computeHedgeValuation(hedge, request.settlementRate, functionalCurrency);
  const recordId = `hv-${randomUUID()}`;
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
  await deps.store.insertHedgeValuation(actor.tenant, id, recordId, record, actor.userId);
  await deps.store.updateHedgeStatus(actor.tenant, id, "settled", valuation.effective);
  await audit(deps, actor, id, "UPDATE", { settlement: record });
  return load(deps, actor.tenant, id);
}

/** Move the settled cash flow hedge reserve into profit or loss (IFRS 9.6.5.11(d)(ii)). */
export async function reclassifyHedgeReserve(
  deps: HedgeDeps,
  actor: Actor,
  id: string,
  request: { date: string; targetAccountId: string },
): Promise<HedgeRelationship> {
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
  const recordId = `hv-${randomUUID()}`;
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
  await deps.store.insertHedgeValuation(actor.tenant, id, recordId, record, actor.userId);
  await deps.store.updateHedgeStatus(actor.tenant, id, "reclassified");
  await audit(deps, actor, id, "UPDATE", { reclassification: record });
  return load(deps, actor.tenant, id);
}
