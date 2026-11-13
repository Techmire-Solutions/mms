import { z } from "zod";
import { baseListQueryFields } from "../core/apiSchemas.js";
import { isoDateSchema } from "../core/isoDateSchema.js";
import type { Account, JournalEntry, FiscalYear } from "./accountingModuleManifest.js";
import { ACCOUNTING_ACCOUNT_TYPES, JOURNAL_ENTRY_STATUSES } from "./accountingEnums.js";

export interface AccountingListQuery {
  page?: number;
  limit?: number;
  search?: string;
  /** Journal-entry status filter (`posted` | `draft`). */
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Restrict journal entries to those with a line on this account. */
  accountId?: string;
  /** Restrict journal entries to those carrying this tag. */
  tag?: string;
  accountType?: string;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  includeDeleted?: boolean;
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
  })
  .passthrough();

/** Query schema for the paginated chart-of-accounts list. */
export const accountingAccountsListQuerySchema = z
  .object({
    ...baseListQueryFields,
    accountType: z.enum(ACCOUNTING_ACCOUNT_TYPES).optional(),
  })
  .passthrough();

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
