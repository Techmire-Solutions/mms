import { createHash, randomUUID } from "node:crypto";
import {
  AmountScaleError,
  buildHedgeValuationLines,
  buildReversalLines,
  computeHedgeValuation,
  type HedgeRelationship,
  type HedgeRelationshipCreate,
  type HedgeValuationRecord,
  type JournalEntry,
} from "@mms/shared";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import type { RecordModernAuditInput } from "../../services/auditTrailService.js";
import { lockLedgerEvent } from "../ledgerPosting/ledgerEventLock.js";
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

export interface Actor {
  tenant: string;
  userId: string | null;
}

export function unprocessable(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 422, type: "validation_error" });
}

/** A stored amount that cannot be represented in its currency is a 422, not a 500. */
export function valuationOrThrow(
  hedge: Parameters<typeof computeHedgeValuation>[0],
  rate: string,
  functionalCurrency: string,
) {
  try {
    return computeHedgeValuation(hedge, rate, functionalCurrency);
  } catch (error) {
    if (error instanceof AmountScaleError) {
      throw unprocessable(
        `Hedge notional ${error.value} cannot be represented in ${error.currency} — use at most ${error.currency} minor units`,
      );
    }
    throw error;
  }
}

export function notFound(): Error {
  return Object.assign(new Error("Hedge relationship not found"), {
    statusCode: 404,
    type: "not_found",
  });
}

/**
 * Deterministic record id for a hedge event.
 *
 * It doubles as the journal `source_id`, so a repeated or concurrent submit for
 * the same relationship/date/kind resolves to the *same* generated entry instead
 * of posting a second one under a random key. The unique index on
 * `accounting_hedge_valuations` is still the invariant; this makes the entry side
 * idempotent as well.
 */
export function hedgeRecordId(relationshipId: string, kind: string, date: string): string {
  // `accounting_entries.source_id` is varchar(64), and the full relationship id is
  // a 43-char uuid string, so the relationship part is hashed: deterministic, but
  // short enough for the source key it doubles as.
  const subject = createHash("sha256").update(relationshipId).digest("hex").slice(0, 12);
  return `hv-${subject}-${kind}-${date}`;
}

/**
 * Runs a hedging write that may collide with a concurrent submit for the same
 * event. The unique index on the valuation table is the invariant, so a unique
 * violation means "the other request already recorded it" — report back the
 * stored relationship instead of failing the caller with a 500.
 */
export async function insertOnce(run: () => Promise<void>): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

type HedgeAccountField = "instrumentAccountId" | "reserveAccountId" | "pnlAccountId";

const HEDGE_ACCOUNT_ROLES: Record<HedgeAccountField, readonly string[]> = {
  instrumentAccountId: ["Asset", "Liability"],
  reserveAccountId: ["Equity"],
  pnlAccountId: ["Revenue", "Expense"],
};

/**
 * Each account has a role: the derivative/cash instrument is an Asset/Liability,
 * the cash flow hedge reserve is Equity and the ineffective part is P&L. The FK
 * only proves the account exists, so a Revenue account could be designated as
 * the reserve and every valuation would post to the wrong statement.
 */
async function assertHedgeAccounts(
  deps: Pick<HedgeDeps, "store">,
  tenant: string,
  hedge: HedgeRelationshipCreate,
): Promise<void> {
  const fields = Object.keys(HEDGE_ACCOUNT_ROLES) as HedgeAccountField[];
  const ids = fields
    .map((field) => hedge[field])
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const byId = new Map((await deps.store.findAccountsByIds(tenant, ids)).map((a) => [a.id, a]));
  const problems: string[] = [];
  for (const field of fields) {
    const accountId = hedge[field];
    if (typeof accountId !== "string" || !accountId) continue;
    const allowed = HEDGE_ACCOUNT_ROLES[field];
    const account = byId.get(accountId);
    if (!account) {
      problems.push(`${field}: unknown or archived account "${accountId}"`);
    } else if (account.isActive === false) {
      problems.push(`${field}: ${account.code} ${account.name} is deactivated`);
    } else if (!allowed.includes(account.type)) {
      problems.push(
        `${field}: ${account.code} ${account.name} is type ${account.type}, expected ${allowed.join(" or ")}`,
      );
    }
  }
  if (problems.length > 0) {
    throw unprocessable(`Invalid hedge accounts — ${problems.join("; ")}`);
  }
}

export async function load(
  deps: HedgeDeps,
  tenant: string,
  id: string,
): Promise<HedgeRelationship> {
  const hedge = await deps.store.findHedgeRelationship(tenant, id);
  if (!hedge) throw notFound();
  return hedge;
}

export async function audit(
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
  await assertHedgeAccounts(deps, actor.tenant, hedge);
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
    ...valuationOrThrow(hedge, rate, functionalCurrency),
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
  // One valuation per hedge and date: serialise the read-then-post so a
  // concurrent submit returns the stored valuation instead of racing the unique
  // index after its journal entries were written.
  await lockLedgerEvent(actor.tenant, `hedge:${id}:valuation:${date}`);
  const existing = await load(deps, actor.tenant, id);
  if (
    existing.valuations.some(
      (record) => record.kind === "valuation" && record.valuationDate === date,
    )
  ) {
    return existing;
  }
  const preview = await previewHedgeValuation(deps, actor.tenant, id, date);
  const recordId = hedgeRecordId(id, "valuation", date);
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
  const inserted = await insertOnce(() =>
    deps.store.insertHedgeValuation(actor.tenant, id, recordId, record, actor.userId),
  );
  if (inserted) await audit(deps, actor, id, "UPDATE", { valuation: record });
  return load(deps, actor.tenant, id);
}

export { reclassifyHedgeReserve, settleHedge } from "./hedgeSettlementUseCases.js";
