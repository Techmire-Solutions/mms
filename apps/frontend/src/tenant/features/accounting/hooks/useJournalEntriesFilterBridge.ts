import { isJournalEntryStatus } from "@mms/shared";
import type { JournalEntriesServerQueryProps } from "../lib/journalEntriesControllerFilters";
import { JOURNAL_FILTER_ALL } from "../lib/journalEntriesControllerFilters";

export function useJournalEntriesFilterBridge(
  filters: JournalEntriesServerQueryProps["filters"],
  onFiltersChange: JournalEntriesServerQueryProps["onFiltersChange"],
) {
  return {
    search: filters.search,
    setSearch: (value: string) => onFiltersChange({ search: value }),
    statusFilter: filters.statusFilter,
    // The menu only emits the `all` sentinel or a stored status; an unknown value
    // falls back to "no filter" instead of widening the query type.
    setStatusFilter: (value: string) =>
      onFiltersChange({
        statusFilter:
          value === JOURNAL_FILTER_ALL || isJournalEntryStatus(value) ? value : JOURNAL_FILTER_ALL,
      }),
    tagFilter: filters.tagFilter,
    setTagFilter: (value: string) => onFiltersChange({ tagFilter: value }),
    dateFrom: filters.dateFrom,
    setDateFrom: (value: string) => onFiltersChange({ dateFrom: value }),
    dateTo: filters.dateTo,
    setDateTo: (value: string) => onFiltersChange({ dateTo: value }),
  };
}
