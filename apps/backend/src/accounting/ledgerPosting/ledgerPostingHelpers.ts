import { findFiscalYearForDate, type FiscalYear, type JournalEntry } from "@mms/shared";
import { findEntryIdBySource, saveEntry } from "../../db/repositories/accountingRepository.js";
import { listFiscalYearsByWorkspace } from "../../db/repositories/accountingFiscalYearsRepository.js";
import {
  assertJournalEntryPeriodOpen,
  prepareJournalEntryForPersist,
} from "../use-cases/accountingLedgerGuards.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";

export function postingDate(value: string | undefined): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
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
export async function persistGeneratedEntry(
  tenant: string,
  entry: JournalEntry,
  years?: readonly FiscalYear[],
): Promise<JournalEntry | null> {
  const existingId = await findEntryIdBySource(
    tenant,
    entry.source_type ?? "",
    entry.source_id ?? "",
  );
  if (existingId) return null;
  const resolvedYears = years ?? (await listFiscalYearsByWorkspace(tenant));
  // System postings are always new, so the period lock applies unconditionally.
  assertJournalEntryPeriodOpen(entry, resolvedYears);
  const prepared = prepareJournalEntryForPersist(entry, resolvedYears);
  try {
    await saveEntry(tenant, prepared);
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
  return prepared;
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
