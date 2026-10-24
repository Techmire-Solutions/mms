import type { JournalEntriesServerQueryProps } from "../lib/journalEntriesControllerFilters";

export function useJournalEntriesFilterBridge(
  filters: JournalEntriesServerQueryProps["filters"],
  onFiltersChange: JournalEntriesServerQueryProps["onFiltersChange"],
) {
  return {
    search: filters.search,
    setSearch: (value: string) => onFiltersChange({ search: value }),
    statusFilter: filters.statusFilter,
    setStatusFilter: (value: string) => onFiltersChange({ statusFilter: value }),
    tagFilter: filters.tagFilter,
    setTagFilter: (value: string) => onFiltersChange({ tagFilter: value }),
    dateFrom: filters.dateFrom,
    setDateFrom: (value: string) => onFiltersChange({ dateFrom: value }),
    dateTo: filters.dateTo,
    setDateTo: (value: string) => onFiltersChange({ dateTo: value }),
  };
}
