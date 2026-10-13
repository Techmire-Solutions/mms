import { useCallback, useEffect, useMemo, useState } from "react";
import type { AccountingListQuery } from "@mms/shared";
import { moneyToCents } from "@mms/shared";
import { useDebounce } from "@/hooks/useDebounce";
import type { JournalEntry } from "@/lib/data/accountingData";
import { getJournalEntryLineTotals } from "@/tenant/features/accounting/components/journalEntriesListShared";

/** Journal Work filter values. Owned by the page that issues the server query. */
export interface JournalEntryFilterState {
  search: string;
  statusFilter: string;
  tagFilter: string;
  dateFrom: string;
  dateTo: string;
}

/** Sentinel the filter menu and the chips use for "no filter on this field". */
export const JOURNAL_FILTER_ALL = "all";

export const EMPTY_JOURNAL_ENTRY_FILTERS: JournalEntryFilterState = {
  search: "",
  statusFilter: JOURNAL_FILTER_ALL,
  tagFilter: JOURNAL_FILTER_ALL,
  dateFrom: "",
  dateTo: "",
};

/**
 * Rows per request. The REST contract caps `limit` at `LIST_PAGE_MAX_LIMIT`;
 * asking for more is a 400, not a clamp.
 */
export const JOURNAL_PAGE_SIZE = 100;

/** Mirrors the repo's directory controllers (contacts/students pattern). */
const SEARCH_DEBOUNCE_MS = 250;

/** Pager contract, shared by the list that renders it and the page that fetches. */
export interface JournalEntriesListPaging {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

/**
 * Props that thread the server query (filter values + pager) from the page that
 * owns the fetch down to the list that renders it.
 */
export interface JournalEntriesServerQueryProps {
  filters: JournalEntryFilterState;
  onFiltersChange: (patch: Partial<JournalEntryFilterState>) => void;
  paging: JournalEntriesListPaging;
}

/**
 * The journal page request for the current filters.
 *
 * The order is pinned to `date desc` — what the list has always shown — because
 * the server's default is `createdAt desc`, a different order that would both
 * change what users see and make "page 2" mean nothing stable.
 */
export function buildJournalEntriesListQuery(
  filters: JournalEntryFilterState,
  page: number,
  limit: number,
  includeDeleted: boolean,
): AccountingListQuery {
  return {
    page,
    limit,
    search: filters.search.trim() || undefined,
    status: filters.statusFilter === JOURNAL_FILTER_ALL ? undefined : filters.statusFilter,
    tag: filters.tagFilter === JOURNAL_FILTER_ALL ? undefined : filters.tagFilter,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    sortField: "date",
    sortDir: "desc",
    includeDeleted,
  };
}

export interface JournalEntriesListQueryState {
  filters: JournalEntryFilterState;
  /** Applies a filter patch and returns to page 1 — the old page is meaningless. */
  patchFilters: (patch: Partial<JournalEntryFilterState>) => void;
  page: number;
  setPage: (page: number) => void;
  query: AccountingListQuery;
}

/**
 * Filter and page state for the server-driven Journal list.
 *
 * Both live with the query they build so a filter change resets the page in the
 * same update, instead of refetching page 3 of a filter the user just replaced.
 * The search text is debounced, and `includeDeleted` (the trash toggle) is part
 * of the request, so flipping it also returns to page 1.
 */
export function useJournalEntriesListQueryState(
  includeDeleted: boolean,
): JournalEntriesListQueryState {
  const [filters, setFilters] = useState(EMPTY_JOURNAL_ENTRY_FILTERS);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(filters.search, SEARCH_DEBOUNCE_MS);

  const patchFilters = useCallback((patch: Partial<JournalEntryFilterState>) => {
    setFilters((previous) => ({ ...previous, ...patch }));
    setPage(1);
  }, []);

  // The trash view is a different row set, so the previous page number is stale.
  useEffect(() => {
    setPage(1);
  }, [includeDeleted]);

  const query = useMemo(
    () =>
      buildJournalEntriesListQuery(
        { ...filters, search: debouncedSearch },
        page,
        JOURNAL_PAGE_SIZE,
        includeDeleted,
      ),
    [filters, debouncedSearch, page, includeDeleted],
  );

  return { filters, patchFilters, page, setPage, query };
}

/**
 * Totals for the footer of the rows currently on screen.
 *
 * Deliberately page-scoped, not ledger-wide: the page mixes posted and draft
 * rows, so an unbalanced draft makes the difference non-zero even though every
 * posted entry balances.
 *
 * Accumulated in integer cents and divided once: summing the per-entry floats
 * turned two balanced 0.10 + 0.20 pages into a "0.30000000000000004" footer.
 */
export function computeJournalGrandTotals(entries: JournalEntry[]): {
  grandDebit: number;
  grandCredit: number;
} {
  let grandDebitCents = 0;
  let grandCreditCents = 0;
  for (const journalEntry of entries) {
    const { totalDebit, totalCredit } = getJournalEntryLineTotals(journalEntry);
    grandDebitCents += moneyToCents(totalDebit);
    grandCreditCents += moneyToCents(totalCredit);
  }
  return { grandDebit: grandDebitCents / 100, grandCredit: grandCreditCents / 100 };
}
