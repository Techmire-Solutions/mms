import { randomUUID } from "node:crypto";
import {
  AmountScaleError,
  MissingPriceIndexError,
  buildIas29JournalLines,
  buildReversalLines,
  computeIas29Restatement,
  type HyperinflationSettings,
  type Ias29Run,
  type JournalEntry,
  type PriceIndexPoint,
} from "@mms/shared";
import type { RecordModernAuditInput } from "../../services/auditTrailService.js";
import { lockLedgerEvent } from "../ledgerPosting/ledgerEventLock.js";
import type { AccountingHyperinflationStore } from "../repository/accountingHyperinflationRepositoryAdapter.js";
import { nextCalendarDay } from "./fxRevaluationUseCases.js";

export interface Ias29Deps {
  store: Pick<
    AccountingHyperinflationStore,
    | "getCurrencySettings"
    | "accountExists"
    | "findAccountsByIds"
    | "getHyperinflationSettings"
    | "saveHyperinflationSettings"
    | "listPriceIndices"
    | "upsertPriceIndices"
    | "listMonthlyMovements"
    | "listIas29Runs"
    | "findIas29RunId"
    | "saveIas29Run"
  >;
  /** Idempotent per (source_type, source_id); null when it already exists. */
  postEntry: (tenant: string, entry: JournalEntry) => Promise<JournalEntry | null>;
  buildEntry: (
    tenant: string,
    sourceType: "ias29_restate" | "ias29_reversal",
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

export async function updateHyperinflationSettings(
  deps: Ias29Deps,
  actor: Actor,
  settings: HyperinflationSettings,
): Promise<HyperinflationSettings> {
  if (settings.netMonetaryAccountId) {
    // The net monetary position gain/loss is presented in P&L (or equity); an
    // Asset/Liability account as the plug would misstate both statements.
    const [account] = await deps.store.findAccountsByIds(actor.tenant, [
      settings.netMonetaryAccountId,
    ]);
    if (!account) {
      throw unprocessable("The net monetary position account does not exist or is archived");
    }
    if (account.isActive === false) {
      throw unprocessable(
        `The net monetary position account ${account.code} ${account.name} is deactivated`,
      );
    }
    if (!["Equity", "Revenue", "Expense"].includes(account.type)) {
      throw unprocessable(
        `The net monetary position account is type ${account.type}, expected Equity, Revenue or Expense`,
      );
    }
  }
  const previous = await deps.store.getHyperinflationSettings(actor.tenant);
  await deps.store.saveHyperinflationSettings(actor.tenant, settings, actor.userId);
  await deps.recordAudit({
    workspaceSubdomain: actor.tenant,
    tableName: "accounting_hyperinflation_settings",
    recordId: actor.tenant,
    actionType: "UPDATE",
    realUserId: actor.userId,
    oldState: previous,
    newState: settings,
  });
  return deps.store.getHyperinflationSettings(actor.tenant);
}

export async function savePriceIndices(
  deps: Ias29Deps,
  actor: Actor,
  points: readonly PriceIndexPoint[],
): Promise<PriceIndexPoint[]> {
  await deps.store.upsertPriceIndices(actor.tenant, points, actor.userId);
  await deps.recordAudit({
    workspaceSubdomain: actor.tenant,
    tableName: "accounting_price_indices",
    recordId: actor.tenant,
    actionType: "UPDATE",
    realUserId: actor.userId,
    newState: { points },
  });
  return deps.store.listPriceIndices(actor.tenant);
}

/** Restatement figures as of `date` without posting anything. */
export async function previewIas29Restatement(
  deps: Ias29Deps,
  tenant: string,
  date: string,
): Promise<Ias29Run> {
  const settings = await deps.store.getHyperinflationSettings(tenant);
  if (!settings.enabled)
    throw unprocessable("IAS 29 restatement is not enabled for this workspace");
  if (settings.appliesFrom && date < settings.appliesFrom) {
    throw unprocessable(
      `The functional currency is hyperinflationary only from ${settings.appliesFrom}`,
    );
  }
  const { functionalCurrency } = await deps.store.getCurrencySettings(tenant);
  const [movements, points] = await Promise.all([
    deps.store.listMonthlyMovements(tenant, date),
    deps.store.listPriceIndices(tenant),
  ]);
  try {
    const restatement = computeIas29Restatement(movements, points, date, functionalCurrency);
    return {
      id: "preview",
      status: "preview",
      entryId: null,
      reversalEntryId: null,
      ...restatement,
    };
  } catch (error) {
    if (error instanceof MissingPriceIndexError) {
      throw unprocessable(`${error.message}; add those price index points first`);
    }
    if (error instanceof AmountScaleError) {
      throw unprocessable(
        `Movement ${error.value} has more decimals than ${error.currency} allows — correct the posted amounts before restating`,
      );
    }
    throw error;
  }
}

/**
 * Post the restatement for `date`: each non-monetary account, equity and P&L
 * account is adjusted to current units against the net monetary position
 * account, with an automatic reversal the next day so the following period
 * restates again from historical amounts. One run per date; repeating the call
 * returns the existing run.
 */
export async function postIas29Restatement(
  deps: Ias29Deps,
  actor: Actor,
  date: string,
): Promise<Ias29Run> {
  const { tenant } = actor;
  // One restatement per date; serialise the read-then-insert (see lockLedgerEvent).
  await lockLedgerEvent(tenant, `ias29:${date}`);
  if (await deps.store.findIas29RunId(tenant, date)) {
    const existing = (await deps.store.listIas29Runs(tenant)).find(
      (run) => run.restatementDate === date,
    );
    if (existing) return existing;
  }
  const preview = await previewIas29Restatement(deps, tenant, date);
  const settings = await deps.store.getHyperinflationSettings(tenant);
  let entryId: string | null = null;
  let reversalEntryId: string | null = null;
  if (preview.lines.length > 0) {
    if (!settings.netMonetaryAccountId) {
      throw unprocessable("Set the net monetary position gain/loss account first");
    }
    const { functionalCurrency } = await deps.store.getCurrencySettings(tenant);
    const lines = buildIas29JournalLines(
      preview,
      settings.netMonetaryAccountId,
      functionalCurrency,
    );
    const entry = await deps.buildEntry(
      tenant,
      "ias29_restate",
      date,
      date,
      `IAS 29 restatement ${date}`,
      lines,
    );
    const reversal = await deps.buildEntry(
      tenant,
      "ias29_reversal",
      date,
      nextCalendarDay(date),
      `Reverse IAS 29 restatement ${date}`,
      buildReversalLines(lines),
    );
    entryId = (await deps.postEntry(tenant, entry))?.id ?? entry.id;
    reversalEntryId = (await deps.postEntry(tenant, reversal))?.id ?? reversal.id;
  }
  const run = {
    ...preview,
    id: `ias29-${randomUUID()}`,
    entryId,
    reversalEntryId,
    createdBy: actor.userId,
  };
  const { status: _status, ...stored } = run;
  await deps.store.saveIas29Run(tenant, stored);
  await deps.recordAudit({
    workspaceSubdomain: tenant,
    tableName: "accounting_ias29_runs",
    recordId: run.id,
    actionType: "CREATE",
    realUserId: actor.userId,
    newState: { ...stored, lines: preview.lines.length },
  });
  return { ...run, status: "posted" };
}
