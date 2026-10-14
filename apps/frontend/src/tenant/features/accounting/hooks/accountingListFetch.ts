import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type {
  Account,
  AccountingEntriesListPageResult,
  AccountingListQuery,
  JournalEntry,
} from "@mms/shared";
import { ACCOUNTING_MODULE_MANIFEST, LIST_PAGE_MAX_LIMIT } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/lib/contexts/AuthContext";

/**
 * Hard bound on the sequential paging loop used by the whole-ledger aggregates.
 * Each page is `LIST_PAGE_MAX_LIMIT` rows, which is what the REST contract
 * accepts — asking for more is a 400, not a clamp.
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
  return params;
}

/** Throws an `ApiError` on a non-200 contract envelope (preserves the old throw-on-!ok). */
function assertOk(response: { status: number; body: unknown }, context: string): void {
  if (response.status === 200) return;
  const errorBody = response.body as { message?: string; type?: string } | undefined;
  throw new ApiError(response.status, errorBody?.message ?? context, errorBody?.type);
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
  assertOk(response, "Failed to fetch accounting entries");
  const body = response.body as Partial<AccountingEntriesListPageResult>;
  return {
    entries: body.entries ?? [],
    total: body.total ?? body.entries?.length ?? 0,
    page: body.page ?? query.page ?? 1,
    limit: body.limit ?? query.limit ?? LIST_PAGE_MAX_LIMIT,
    hasMore: body.hasMore ?? false,
  };
}

/**
 * Mirrors `ACCOUNTING_ENTRIES_QUERY_KEY` from `useAccountingApi` — importing it
 * here would create an import cycle, and an identical prefix is what keeps the
 * existing post-write invalidation refreshing this page.
 */
const ACCOUNTING_ENTRIES_LIST_QUERY_KEY = [
  ACCOUNTING_MODULE_MANIFEST.moduleId,
  "entries",
  "list",
] as const;

/** Server-driven page of the Journal list: filters, order and page live in the query. */
export function useAccountingEntriesPage(
  query: AccountingListQuery,
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = (options?.enabled ?? true) && isAuthenticated;
  const params = JSON.stringify(buildAccountingEntriesPageParams(query));

  return useQuery({
    queryKey: [...ACCOUNTING_ENTRIES_LIST_QUERY_KEY, "page", params],
    queryFn: ({ signal }): Promise<AccountingEntriesListPageResult> =>
      fetchAccountingEntriesPage(query, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/**
 * Paged-through fetch of every journal entry matching `query`.
 *
 * `computeTrialBalance` / `computeFinancials` / `computeLedger` are whole-ledger
 * aggregates, so a single capped page understates them silently with no error —
 * the page-1-of-100 fetch summed the 100 most recently *created* entries while
 * the balance badge still read "Balanced". Each request stays bounded at the
 * contract's maximum page size and stops as soon as the server reports no more.
 */
export async function fetchAllAccountingEntries(
  query: AccountingListQuery,
  signal?: AbortSignal,
): Promise<JournalEntry[]> {
  const collected: JournalEntry[] = [];
  for (let page = 1; page <= MAX_AGGREGATE_PAGES; page += 1) {
    const response = await apiContract.accounting.listEntries({
      query: buildAccountingEntriesPageParams({ ...query, page, limit: LIST_PAGE_MAX_LIMIT }),
      signal,
      fetchOptions: { signal },
    });
    assertOk(response, "Failed to fetch accounting entries");
    const body = response.body as { entries?: JournalEntry[]; hasMore?: boolean };
    const batch = body.entries ?? [];
    collected.push(...batch);
    if (!body.hasMore || batch.length === 0) return collected;
  }
  // Bounded: a ledger larger than this needs a server-side aggregate rather than
  // shipping every row to the browser.
  return collected;
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
    assertOk(response, "Failed to fetch accounting accounts");
    const body = response.body as { accounts?: Account[]; hasMore?: boolean };
    const batch = body.accounts ?? [];
    collected.push(...batch);
    if (!body.hasMore || batch.length === 0) return collected;
  }
  return collected;
}
