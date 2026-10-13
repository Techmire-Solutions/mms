import { useState, useRef, useCallback } from "react";
import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";
import { ACCOUNTING_WORK_SEARCH_INPUT_ID } from "@/tenant/features/accounting/components/JournalEntriesListFilters";
import type { useJournalEntriesListQueryState } from "@/tenant/features/accounting/lib/journalEntriesControllerFilters";

export interface UseAccountingPageShortcutsParams {
  activeTab: string;
  activeSubTab: string;
  canWrite: boolean;
  showDeleted: boolean;
  openJournalCreate: () => void;
  journalList: ReturnType<typeof useJournalEntriesListQueryState>;
}

export function useAccountingPageShortcuts({
  activeTab,
  activeSubTab,
  canWrite,
  showDeleted,
  openJournalCreate,
  journalList,
}: UseAccountingPageShortcutsParams) {
  const [journalShortcutState, setJournalShortcutState] = useState({
    mode: "simple" as "simple" | "advanced",
    selectedCount: 0,
  });
  const clearJournalSelectionRef = useRef<() => void>(() => {});

  const handleShortcutStateChange = useCallback(
    (state: { mode: "simple" | "advanced"; selectedCount: number; clearSelection: () => void }) => {
      clearJournalSelectionRef.current = state.clearSelection;
      setJournalShortcutState((current) =>
        current.mode === state.mode && current.selectedCount === state.selectedCount
          ? current
          : { mode: state.mode, selectedCount: state.selectedCount },
      );
    },
    [],
  );

  const hasActiveJournalFilters =
    journalList.filters.search.trim().length > 0 ||
    journalList.filters.statusFilter !== "all" ||
    journalList.filters.tagFilter !== "all" ||
    Boolean(journalList.filters.dateFrom || journalList.filters.dateTo);

  useModuleShortcuts({
    searchInputId: ACCOUNTING_WORK_SEARCH_INPUT_ID,
    searchEnabled: journalShortcutState.mode === "advanced",
    selectedCount: journalShortcutState.selectedCount,
    hasActiveFilters: hasActiveJournalFilters,
    clearFilters: () =>
      journalList.patchFilters({
        search: "",
        statusFilter: "all",
        tagFilter: "all",
        dateFrom: "",
        dateTo: "",
      }),
    clearSelection: () => clearJournalSelectionRef.current(),
    canWrite,
    showDeleted,
    onCreate: openJournalCreate,
    enabled: activeTab === "work" && activeSubTab === "journal",
  });

  return {
    handleShortcutStateChange,
  };
}
