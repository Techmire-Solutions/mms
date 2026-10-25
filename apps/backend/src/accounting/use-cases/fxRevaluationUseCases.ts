import { randomUUID } from "node:crypto";
import {
  MissingClosingRatesError,
  buildFxRevaluationJournalLines,
  buildReversalLines,
  computeFxRevaluation,
  totalUnrealized,
  type ForeignMonetaryBalance,
  type FxRevaluationLine,
  type FxRevaluationRun,
  type JournalEntry,
  type PostingRules,
} from "@mms/shared";
import type { RecordModernAuditInput } from "../../services/auditTrailService.js";
import type { AccountingFxRepository } from "../repository/accountingFxRepository.js";

export interface FxRevaluationDeps {
  fx: AccountingFxRepository;
  listBalances: (
    tenant: string,
    date: string,
    functional: string,
  ) => Promise<ForeignMonetaryBalance[]>;
  listRuns: (tenant: string) => Promise<FxRevaluationRun[]>;
  findRunId: (tenant: string, date: string) => Promise<string | null>;
  saveRun: (
    tenant: string,
    run: Omit<FxRevaluationRun, "status" | "createdAt">,
    lines: readonly FxRevaluationLine[],
  ) => Promise<void>;
  getPostingRules: (tenant: string) => Promise<PostingRules>;
  /** Idempotent per (source_type, source_id); null when it already exists. */
  postEntry: (tenant: string, entry: JournalEntry) => Promise<JournalEntry | null>;
  buildEntry: (
    tenant: string,
    sourceType: "fx_reval" | "fx_reval_reversal",
    sourceId: string,
    date: string,
    description: string,
    lines: JournalEntry["lines"],
  ) => Promise<JournalEntry>;
  recordAudit: (input: RecordModernAuditInput) => Promise<unknown>;
}

function validationError(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 422, type: "validation_error" });
}

/** The calendar day after `date` (YYYY-MM-DD, UTC arithmetic on a date-only value). */
export function nextCalendarDay(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/**
 * Closing rate per currency: the CLOSING rate on or before the date, else the
 * SPOT rate of that day (IAS 21 defines closing as the spot rate at the end of
 * the period). Currencies with neither are reported, never assumed to be 1.
 */
/** CLOSING rate on or before `date`, else that day's SPOT rate; null when neither exists. */
export async function lookupClosingRate(
  fx: Pick<AccountingFxRepository, "lookupExchangeRate">,
  tenant: string,
  currency: string,
  functional: string,
  date: string,
): Promise<string | null> {
  for (const rateType of ["CLOSING", "SPOT"] as const) {
    const found = await fx.lookupExchangeRate(tenant, {
      fromCurrency: currency,
      toCurrency: functional,
      date,
      rateType,
    });
    if (found) return found.rate;
  }
  return null;
}

async function closingRates(
  deps: FxRevaluationDeps,
  tenant: string,
  currencies: readonly string[],
  functional: string,
  date: string,
): Promise<Map<string, string>> {
  const rates = new Map<string, string>();
  for (const currency of currencies) {
    const rate = await lookupClosingRate(deps.fx, tenant, currency, functional, date);
    if (rate) rates.set(currency, rate);
  }
  return rates;
}

/** Revaluation figures as of `date` without posting anything. */
export async function previewFxRevaluation(
  deps: FxRevaluationDeps,
  tenant: string,
  date: string,
): Promise<FxRevaluationRun> {
  const { functionalCurrency } = await deps.fx.getCurrencySettings(tenant);
  const balances = await deps.listBalances(tenant, date, functionalCurrency);
  const currencies = [...new Set(balances.map((b) => b.currency))];
  const rates = await closingRates(deps, tenant, currencies, functionalCurrency, date);
  let lines: FxRevaluationLine[];
  try {
    lines = computeFxRevaluation(balances, rates, functionalCurrency);
  } catch (error) {
    if (error instanceof MissingClosingRatesError) {
      throw validationError(
        `${error.message} on or before ${date}; add a CLOSING or SPOT rate first`,
      );
    }
    throw error;
  }
  return {
    id: "preview",
    revaluationDate: date,
    status: "preview",
    functionalCurrency,
    totalUnrealized: totalUnrealized(lines, functionalCurrency),
    entryId: null,
    reversalEntryId: null,
    lines,
  };
}

/**
 * Post the revaluation for `date`: Dr/Cr each monetary balance against the
 * unrealized FX account, with an automatic reversal dated the next day so the
 * following period starts again from booked rates. One run per date; repeating
 * the call returns the existing run.
 */
export async function postFxRevaluation(
  deps: FxRevaluationDeps,
  actor: { tenant: string; userId: string | null },
  date: string,
): Promise<FxRevaluationRun> {
  const { tenant } = actor;
  if (await deps.findRunId(tenant, date)) {
    const existing = (await deps.listRuns(tenant)).find((run) => run.revaluationDate === date);
    if (existing) return existing;
  }
  const preview = await previewFxRevaluation(deps, tenant, date);
  let entryId: string | null = null;
  let reversalEntryId: string | null = null;
  if (preview.lines.length > 0) {
    const rules = await deps.getPostingRules(tenant);
    if (!rules.fxUnrealizedAccountId) {
      throw validationError("Set an unrealized FX gain/loss account in posting rules first");
    }
    const lines = buildFxRevaluationJournalLines(
      preview.lines,
      rules.fxUnrealizedAccountId,
      preview.functionalCurrency,
      date,
    );
    const entry = await deps.buildEntry(
      tenant,
      "fx_reval",
      date,
      date,
      `FX revaluation ${date}`,
      lines,
    );
    const reversalDate = nextCalendarDay(date);
    const reversal = await deps.buildEntry(
      tenant,
      "fx_reval_reversal",
      date,
      reversalDate,
      `Reverse FX revaluation ${date}`,
      buildReversalLines(lines),
    );
    entryId = (await deps.postEntry(tenant, entry))?.id ?? entry.id;
    reversalEntryId = (await deps.postEntry(tenant, reversal))?.id ?? reversal.id;
  }
  const run = {
    id: `fxr-${randomUUID()}`,
    revaluationDate: date,
    functionalCurrency: preview.functionalCurrency,
    totalUnrealized: preview.totalUnrealized,
    entryId,
    reversalEntryId,
    lines: preview.lines,
    createdBy: actor.userId,
  };
  await deps.saveRun(tenant, run, preview.lines);
  await deps.recordAudit({
    workspaceSubdomain: tenant,
    tableName: "accounting_fx_revaluation_runs",
    recordId: run.id,
    actionType: "CREATE",
    realUserId: actor.userId,
    newState: { ...run, lines: preview.lines.length },
  });
  return { ...run, status: "posted" };
}
