import { z } from "zod";
import {
  accountRecordSchema,
  fiscalYearRecordSchema,
  journalEntryRecordSchema,
} from "./accountingModuleManifest.js";
import { isJournalEntryBalanced, isJournalLineSingleSided } from "./accountingLedgerInvariants.js";
import { journalCurrencyImbalances } from "./accountingCurrencyBalance.js";

/**
 * Collection-level list schemas for the bulk upsert request/response envelopes,
 * split out of `accountingModuleManifest` so each file stays inside the 300-line
 * ceiling. `accountingModuleManifest` re-exports this module, so existing imports
 * are unchanged.
 */

/**
 * Bulk-upsert request/response ceiling. The UI sends the whole chart in one
 * `PUT …/accounts/bulk`, so this stays above any realistic chart while giving an
 * oversized body a 400 with field-level issues instead of an unbounded parse.
 */
export const ACCOUNTING_ACCOUNTS_BULK_CAP = 2000;

export const accountListSchema = z.array(accountRecordSchema).max(ACCOUNTING_ACCOUNTS_BULK_CAP);

/** Bulk-upsert ceiling for journal entries (the directory page is at most 100). */
export const ACCOUNTING_ENTRIES_BULK_CAP = 2000;

export const journalEntryListSchema = z
  .array(journalEntryRecordSchema)
  .max(ACCOUNTING_ENTRIES_BULK_CAP);

/**
 * Write-side journal voucher: the stored record plus the ledger invariants a
 * **posted** voucher must satisfy before it leaves the API boundary.
 *
 * The use-case guard (`prepareJournalEntryForPersist`) and the 0254 database trigger
 * still enforce the same rules; this refinement turns the failure into a normal 400
 * with the offending field path instead of a later 422/500. Drafts stay shape-only:
 * an unfinished voucher is allowed to be unbalanced while it is being written. The
 * response schema (`journalEntryRecordSchema`) is deliberately unchanged so legacy
 * posted rows that predate the trigger can still be serialised.
 */
export const journalEntryWriteSchema = journalEntryRecordSchema.superRefine((entry, ctx) => {
  if (entry.status !== "posted") return;
  const lines = entry.lines ?? [];
  if (!isJournalEntryBalanced(lines)) {
    ctx.addIssue({
      code: "custom",
      path: ["lines"],
      message: "accounting.voucher.unbalanced",
    });
    return;
  }
  if (lines.some((line) => !isJournalLineSingleSided(line))) {
    ctx.addIssue({
      code: "custom",
      path: ["lines"],
      message: "accounting.journal.form.errorSingleSided",
    });
  }
  const imbalances = journalCurrencyImbalances(lines);
  if (imbalances.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["lines"],
      message: "accounting.voucher.unbalanced",
    });
  }
});

/** Bulk request body for `PUT /api/accounting/entries/bulk`. */
export const journalEntryWriteListSchema = z
  .array(journalEntryWriteSchema)
  .max(ACCOUNTING_ENTRIES_BULK_CAP);

/** Bulk-upsert ceiling for fiscal years (one per accounting year). */
export const ACCOUNTING_FISCAL_YEARS_BULK_CAP = 200;

export const fiscalYearListSchema = z
  .array(fiscalYearRecordSchema)
  .max(ACCOUNTING_FISCAL_YEARS_BULK_CAP);
