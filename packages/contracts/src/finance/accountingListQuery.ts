import { z } from "zod";
import { baseListQueryFields } from "../core/apiSchemas.js";
import { isoDateSchema } from "../core/isoDateSchema.js";
import type { Account, JournalEntry, FiscalYear } from "./accountingModuleManifest.js";
import {
  ACCOUNTING_ACCOUNT_TYPES,
  JOURNAL_ENTRY_STATUSES,
  type AccountingAccountType,
  type JournalEntryStatus,
} from "./accountingEnums.js";

export interface AccountingListQuery {
  page?: number;
  limit?: number;
  search?: string;
  /** Journal-entry status filter; the UI's `all` sentinel is converted to `undefined`. */
  status?: JournalEntryStatus;
  dateFrom?: string;
  dateTo?: string;
  /** Restrict journal entries to those with a line on this account. */
  accountId?: string;
  /** Restrict journal entries to those carrying this tag. */
  tag?: string;
  accountType?: AccountingAccountType;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  includeDeleted?: boolean;
  /**
   * Journal register projection. `false` returns header fields plus the
   * `lineCount`/`debitTotal`/`creditTotal` summary and an empty `lines` array,
   * so a dense voucher no longer ships every line to the list (the drawer fetches
   * the full entry by id). Defaults to `true`.
   */
  includeLines?: boolean;
}

/**
 * Query schema for the paginated journal-entry list.
 *
 * `status`, `dateFrom` and `dateTo` were declared on {@link AccountingListQuery}
 * and sent by the UI but were absent here, so ts-rest dropped them: the Journal
 * tab's status and date-range controls changed the query key (causing a refetch
 * spinner) while the request — and therefore the result — stayed unfiltered.
 *
 * `tag` is here for the same reason: with server-side paging a tag filter applied
 * only in the browser narrows one page at a time, so "no results" can be shown
 * while matching entries exist on another page.
 */
export const accountingEntriesListQuerySchema = z
  .object({
    ...baseListQueryFields,
    status: z.enum(JOURNAL_ENTRY_STATUSES).optional(),
    // Real calendar days, ordered: a malformed string reached the `date` column
    // and raised PostgreSQL 22007 (unhandled 500) instead of a 400.
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    accountId: z.string().max(64).optional(),
    // 64 is the `accounting_entry_tags.tag` column width.
    tag: z.string().max(64).optional(),
    includeLines: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  })
  // Strict: a misspelled filter (`stat=posted`) used to be accepted and then
  // ignored, returning unfiltered data under a filtered-looking UI.
  .strict();

/** Query schema for the paginated chart-of-accounts list. */
export const accountingAccountsListQuerySchema = z
  .object({
    ...baseListQueryFields,
    accountType: z.enum(ACCOUNTING_ACCOUNT_TYPES).optional(),
  })
  .strict();

/**
 * Query schema for the paginated fiscal-year list.
 *
 * Its own strict schema instead of changing the global `baseListQuerySchema`,
 * which every module shares — only Accounting opts into rejecting unknown keys.
 */
export const accountingFiscalYearsListQuerySchema = z.object(baseListQueryFields).strict();

export type AccountingEntriesListQuery = z.infer<typeof accountingEntriesListQuerySchema>;
export type AccountingAccountsListQuery = z.infer<typeof accountingAccountsListQuerySchema>;

export interface AccountingAccountsListPageResult {
  accounts: Account[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AccountingEntriesListPageResult {
  entries: JournalEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AccountingFiscalYearsListPageResult {
  fiscalYears: FiscalYear[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
