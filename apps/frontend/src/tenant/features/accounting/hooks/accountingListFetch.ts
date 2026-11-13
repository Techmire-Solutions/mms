import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type {
  Account,
  AccountingEntriesListPageResult,
  AccountingLedgerPage,
  AccountingListQuery,
} from "@mms/shared";
import { LIST_PAGE_MAX_LIMIT } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { useAuth } from "@/lib/contexts/AuthContext";
import { assertContractOk } from "@/lib/apiContractError";
// Imported from the keys module (no cycle): the register page must share the exact
// prefix the post-write invalidation targets.
import { ACCOUNTING_ENTRIES_LIST_PREFIX } from "./accountingQueryKeys";

/**
 * Hard bound on the sequential paging loops that remain (whole chart of accounts,
 * ledger export). The journal-entry equivalent was removed with the server report
 * aggregates: the Overview/Journal tabs no longer page the whole ledger down.
 */
const MAX_AGGREGATE_PAGES = 50;

/**
 * Query params for one `listEntries` request, mirroring the contract's
 * `accountingEntriesListQuerySchema`.
 *
 * `tag` is included: it is on the schema, and with server-side paging a tag
 * filter applied only in the browser narrows one page at a time.
 */
export function buildAccountingEntriesPageParams(
  query: AccountingListQuery,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {
    page: query.page ?? 1,
    limit: Math.min(query.limit ?? LIST_PAGE_MAX_LIMIT, LIST_PAGE_MAX_LIMIT),
  };
  if (query.search) params.search = query.search;
  if (query.status) params.status = query.status;
  if (query.tag) params.tag = query.tag;
  if (query.dateFrom) params.dateFrom = query.dateFrom;
  if (query.dateTo) params.dateTo = query.dateTo;
  if (query.accountId) params.accountId = query.accountId;
  if (query.sortField) params.sortField = query.sortField;
  if (query.sortDir) params.sortDir = query.sortDir;
  if (query.includeDeleted) params.includeDeleted = true;
  // Full vouchers: the register's own consumers (Cashbook classification, the
  // simple wizard's balance hint, the voucher Print action) need the line sets, and
  // the drawer/edit/post paths read them too. The header-only projection shipped no
  // lines and every derived figure read 0.00, so it is not requested here; a
  // per-view opt-in remains available through `query.includeLines === false`.
  if (query.includeLines === false) params.includeLines = "false";
  return params;
}

/**
 * One page of journal entries, with the server's total for the active filter.
 *
 * The total is what the pager and the "shown" metric read — `entries.length` is
 * only the rows on this page.
 */
export async function fetchAccountingEntriesPage(
  query: AccountingListQuery,
  signal?: AbortSignal,
): Promise<AccountingEntriesListPageResult> {
  const response = await apiContract.accounting.listEntries({
    query: buildAccountingEntriesPageParams(query),
    signal,
    fetchOptions: { signal },
  });
  assertContractOk(response, "Failed to fetch accounting entries");
  const body = response.body as Partial<AccountingEntriesListPageResult>;
  return {
    entries: body.entries ?? [],
    total: body.total ?? body.entries?.length ?? 0,
    page: body.page ?? query.page ?? 1,
    limit: body.limit ?? query.limit ?? LIST_PAGE_MAX_LIMIT,
    hasMore: body.hasMore ?? false,
  };
}

/** Server-driven page of the Journal list: filters, order and page live in the query. */
export function useAccountingEntriesPage(
  query: AccountingListQuery,
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated;
  const params = JSON.stringify(buildAccountingEntriesPageParams(query));

  return useQuery({
    queryKey: [...ACCOUNTING_ENTRIES_LIST_PREFIX, "page", params],
    queryFn: ({ signal }): Promise<AccountingEntriesListPageResult> =>
      fetchAccountingEntriesPage(query, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** Hard bound on the ledger export paging loop (each page is 100 lines). */
const MAX_LEDGER_EXPORT_PAGES = 50;

export interface AccountingLedgerExport {
  lines: AccountingLedgerPage["lines"];
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  truncated: boolean;
}

/**
 * Every line of one account's ledger, paged through the server report.
 *
 * The export must not silently stop at the first page (the browser aggregate bug):
 * it pages until the server reports no more, and flags a ledger larger than the
 * export cap so the caller can warn instead of presenting a partial CSV.
 */
export async function fetchAllAccountingLedgerLines(
  accountId: string,
  dateFrom?: string,
  dateTo?: string,
  signal?: AbortSignal,
): Promise<AccountingLedgerExport> {
  const lines: AccountingLedgerPage["lines"] = [];
  let first: AccountingLedgerPage | undefined;
  let truncated = true;
  for (let page = 1; page <= MAX_LEDGER_EXPORT_PAGES; page += 1) {
    const response = await apiContract.accounting.getLedger({
      query: {
        accountId,
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        page,
        limit: LIST_PAGE_MAX_LIMIT,
      },
      signal,
      fetchOptions: { signal },
    });
    assertContractOk(response, "Failed to fetch the account ledger");
    const body = response.body as AccountingLedgerPage;
    first ??= body;
    lines.push(...body.lines);
    if (!body.hasMore) {
      truncated = false;
      break;
    }
  }
  return {
    lines,
    openingBalance: first?.openingBalance ?? 0,
    totalDebit: first?.totalDebit ?? 0,
    totalCredit: first?.totalCredit ?? 0,
    closingBalance: first?.closingBalance ?? 0,
    truncated,
  };
}

/** Paged-through fetch of the whole chart of accounts, in a stable code order. */
export async function fetchAllAccountingAccounts(
  options: { includeDeleted?: boolean; sortField?: string; sortDir?: "asc" | "desc" } = {},
  signal?: AbortSignal,
): Promise<Account[]> {
  const includeDeleted = options.includeDeleted ?? false;
  const sortField = options.sortField ?? "code";
  const sortDir = options.sortDir ?? "asc";
  const collected: Account[] = [];
  for (let page = 1; page <= MAX_AGGREGATE_PAGES; page += 1) {
    const response = await apiContract.accounting.listAccounts({
      query: {
        page,
        limit: LIST_PAGE_MAX_LIMIT,
        sortField,
        sortDir,
        ...(includeDeleted ? { includeDeleted: true } : {}),
      },
      signal,
      fetchOptions: { signal },
    });
    assertContractOk(response, "Failed to fetch accounting accounts");
    const body = response.body as { accounts?: Account[]; hasMore?: boolean };
    const batch = body.accounts ?? [];
    collected.push(...batch);
    if (!body.hasMore || batch.length === 0) return collected;
  }
  return collected;
}
