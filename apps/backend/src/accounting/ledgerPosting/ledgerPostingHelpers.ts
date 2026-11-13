import { workspaceTodayIso } from "../../lib/workspaceDay.js";
import { findFiscalYearForDate, type FiscalYear, type JournalEntry } from "@mms/shared";
import {
  bulkSaveEntries,
  findEntryIdBySource,
  saveEntry,
} from "../../db/repositories/accountingRepository.js";
import { findClosedPostingPeriodForDate } from "../../db/repositories/accountingPostingPeriodsRepository.js";
import { listFiscalYearsByWorkspace } from "../../db/repositories/accountingFiscalYearsRepository.js";
import {
  assertJournalEntryPeriodOpen,
  assertPostingPeriodOpen,
  prepareJournalEntryForPersist,
} from "../use-cases/accountingLedgerGuards.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import { withTenant } from "../../db/tenant-context.js";
import { lockFiscalYearsForEntries } from "./fiscalYearPostingLock.js";

/**
 * The calendar day a generated journal entry is booked on.
 *
 * An explicit document date (invoice due date, payment date, collection date) is
 * used verbatim. A missing date means "today", and "today" is the workspace's
 * business day — `new Date().toISOString()` is the UTC day, which is still
 * yesterday for a UTC+5 tenant until 05:00 local, so a credit note raised in the
 * morning used to post into the previous accounting day.
 */
export async function postingDateForTenant(tenant: string, value?: string | null): Promise<string> {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return workspaceTodayIso(tenant);
}

/**
 * Locks every year a batch of entries can post into (declared + date-derived)
 * and returns the fiscal years read *after* that lock, so a close that committed
 * while we waited is visible.
 */
async function lockedFiscalYears(
  tenant: string,
  entries: readonly JournalEntry[],
  years?: readonly FiscalYear[],
): Promise<FiscalYear[]> {
  const known = years ?? (await listFiscalYearsByWorkspace(tenant));
  await lockFiscalYearsForEntries(tenant, entries, known);
  return listFiscalYearsByWorkspace(tenant);
}

/** Re-checks the monthly lock under the fiscal-year lock (a close may have run). */
async function assertPostingWindowOpen(
  tenant: string,
  entryDates: readonly string[],
): Promise<void> {
  for (const date of entryDates) {
    await assertPostingPeriodOpen(date, (value) => findClosedPostingPeriodForDate(tenant, value));
  }
}

/**
 * Persist a system-generated entry at most once per `(source_type, source_id)`.
 *
 * Idempotency is enforced twice: this pre-check, and the partial unique index
 * `accounting_entries_workspace_source_uidx`. Two concurrent callers can both
 * pass the pre-check, so a unique violation on save means "the other caller won
 * the race and the posting already exists" — an expected outcome, not an error,
 * and it must not surface to the user as a 500.
 */
/**
 * Live-push the accounting collections after a generated posting.
 *
 * Finance-originated postings (invoice/payment/credit/reversal/opening/close/FX)
 * only broadcast `finance_*` collections, so Accounting clients — and this tab
 * after a payment if the socket is down — kept stale ledger/report caches. The
 * broadcast is best-effort: a push failure must never fail a committed posting.
 */
async function broadcastLedgerWrite(tenant: string): Promise<void> {
  try {
    const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
    broadcastTenantUpdate(tenant, "collection", "accounting_entries");
    broadcastTenantUpdate(tenant, "collection", "accounting_metrics");
  } catch {
    // Live push is advisory; the mutation's own invalidation still refreshes the actor.
  }
}

export async function persistGeneratedEntry(
  tenant: string,
  entry: JournalEntry,
  years?: readonly FiscalYear[],
): Promise<JournalEntry | null> {
  // Own the transaction when the caller did not open one: the advisory lock must
  // still be held while the entry is written, not released before the insert.
  return withTenant(tenant, async () => {
    const existingId = await findEntryIdBySource(
      tenant,
      entry.source_type ?? "",
      entry.source_id ?? "",
    );
    if (existingId) return null;
    const resolvedYears = await lockedFiscalYears(tenant, [entry], years);
    // The period check must run under the fiscal-year lock: a close may have
    // flipped the year to closed while this posting waited for it.
    assertJournalEntryPeriodOpen(entry, resolvedYears);
    await assertPostingWindowOpen(tenant, [entry.date]);
    const prepared = prepareJournalEntryForPersist(entry, resolvedYears);
    try {
      await saveEntry(tenant, prepared);
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
    await broadcastLedgerWrite(tenant);
    return prepared;
  });
}

/**
 * Batch form of {@link persistGeneratedEntry}: posting rules and fiscal years are
 * resolved once per batch, each source key is checked for an existing posting,
 * and the remaining entries are written with a single `bulkSaveEntries`.
 *
 * Used by batch invoice generation so a term's invoices cannot be written
 * without their Dr AR / Cr Income postings.
 */
export async function persistGeneratedEntries(
  tenant: string,
  entries: readonly JournalEntry[],
  years?: readonly FiscalYear[],
): Promise<JournalEntry[]> {
  if (entries.length === 0) return [];
  return withTenant(tenant, async () => {
    const resolvedYears = await lockedFiscalYears(tenant, entries, years);
    const pending: JournalEntry[] = [];
    for (const entry of entries) {
      const existingId = await findEntryIdBySource(
        tenant,
        entry.source_type ?? "",
        entry.source_id ?? "",
      );
      if (!existingId) pending.push(entry);
    }
    if (pending.length === 0) return [];
    await assertPostingWindowOpen(
      tenant,
      pending.map((entry) => entry.date),
    );
    const prepared = pending.map((entry) => {
      assertJournalEntryPeriodOpen(entry, resolvedYears);
      return prepareJournalEntryForPersist(entry, resolvedYears);
    });
    await bulkSaveEntries(tenant, prepared);
    await broadcastLedgerWrite(tenant);
    return prepared;
  });
}

export function entryForSource(
  sourceType: JournalEntry["source_type"],
  sourceId: string,
  date: string,
  description: string,
  lines: JournalEntry["lines"],
  fiscalYearId?: string,
): JournalEntry {
  return {
    id: `je-${sourceType}-${sourceId}`,
    date,
    ref: `${sourceType}:${sourceId}`,
    description,
    status: "posted",
    created_by: "system",
    tags: [],
    attachments: [],
    fiscal_year: "",
    fiscal_year_id: fiscalYearId,
    source_type: sourceType,
    source_id: sourceId,
    lines,
  };
}

/**
 * Fiscal year whose range contains the posting date. Returns undefined when the
 * date falls outside every configured year rather than silently posting to the
 * active year.
 */
export function resolveYearId(years: readonly FiscalYear[], date: string): string | undefined {
  return findFiscalYearForDate(years, date)?.id;
}
