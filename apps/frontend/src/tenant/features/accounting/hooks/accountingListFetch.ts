import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type {
  Account,
  AccountingEntriesListPageResult,
  AccountingListQuery,
  JournalEntry,
} from "@mms/shared";
import { ACCOUNTING_MODULE_MANIFEST, LIST_PAGE_MAX_LIMIT } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";
import { useAuth } from "@/lib/contexts/AuthContext";

/**
 * Hard bound on the sequential paging loop used by the whole-ledger aggregates.
 * Each page is `LIST_PAGE_MAX_LIMIT` rows, which is what the REST contract
 * accepts — asking for more is a 400, not a clamp.
 */
const MAX_AGGREGATE_PAGES = 50;

/**
 * Query params for one `GET /entries` request, mirroring the contract's
 * `listEntries` query.
 *
 * `tag` is sent here rather than through `useAccountingEntriesPaginated`:
 * that hook predates the tag filter and forwards a fixed field list, so a tag
 * passed to it would never reach the server and the filter would silently
 * narrow only the rows already loaded.
 */
export function buildAccountingEntriesPageParams(query: AccountingListQuery): URLSearchParams {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    limit: String(Math.min(query.limit ?? LIST_PAGE_MAX_LIMIT, LIST_PAGE_MAX_LIMIT)),
  });
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.tag) params.set("tag", query.tag);
  if (query.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query.dateTo) params.set("dateTo", query.dateTo);
  if (query.accountId) params.set("accountId", query.accountId);
  if (query.sortField) params.set("sortField", query.sortField);
  if (query.sortDir) params.set("sortDir", query.sortDir);
  if (query.includeDeleted) params.set("includeDeleted", "true");
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
  const params = buildAccountingEntriesPageParams(query);
  const body = await apiJson<Partial<AccountingEntriesListPageResult>>(
    `${ACCOUNTING_MODULE_MANIFEST.restBasePath}/entries?${params.toString()}`,
    { signal },
  );
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
  const params = buildAccountingEntriesPageParams(query).toString();

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
    const params = buildAccountingEntriesPageParams({
      ...query,
      page,
      limit: LIST_PAGE_MAX_LIMIT,
    });

    const body = await apiJson<{ entries?: JournalEntry[]; hasMore?: boolean }>(
      `${ACCOUNTING_MODULE_MANIFEST.restBasePath}/entries?${params.toString()}`,
      { signal },
    );
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
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIST_PAGE_MAX_LIMIT),
      sortField,
      sortDir,
    });
    if (includeDeleted) params.set("includeDeleted", "true");

    const body = await apiJson<{ accounts?: Account[]; hasMore?: boolean }>(
      `${ACCOUNTING_MODULE_MANIFEST.restBasePath}/accounts?${params.toString()}`,
      { signal },
    );
    const batch = body.accounts ?? [];
    collected.push(...batch);
    if (!body.hasMore || batch.length === 0) return collected;
  }
  return collected;
}
