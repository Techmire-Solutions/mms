import { useEffect, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import type { JournalEntriesProps } from "@/tenant/features/accounting/lib/journalEntriesTypes";
import {
  buildJournalModeTabs,
  buildJournalStatusConfig,
  buildJournalSubTabs,
} from "@/tenant/features/accounting/lib/journalEntriesControllerConfig";
import {
  computeJournalGrandTotals,
  type JournalEntriesServerQueryProps,
} from "@/tenant/features/accounting/lib/journalEntriesControllerFilters";
import { createJournalNlHandlers } from "@/tenant/features/accounting/components/journalEntriesControllerSelection";
import { useWorkSelection } from "@/hooks/useWorkSelection";
import { useJournalEntriesUiState } from "../hooks/useJournalEntriesUiState";
import { useJournalEntriesFilterBridge } from "../hooks/useJournalEntriesFilterBridge";
import { useJournalEntriesActions } from "../hooks/useJournalEntriesActions";

type JournalEntriesControllerProps = JournalEntriesProps & JournalEntriesServerQueryProps;

export function useJournalEntriesController({
  entries,
  accounts,
  settings: __settings,
  fiscalYears: _fiscalYears,
  onChange,
  onFilteredCountChange,
  onShortcutStateChange,
  canWrite = true,
  canDelete = true,
  showDeleted = false,
  createRequestKey = 0,
  onDelete,
  onRestore,
  onBulkDelete,
  onBulkRestore,
  filters,
  onFiltersChange,
  paging,
}: JournalEntriesControllerProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();
  const journalStatusConfig = buildJournalStatusConfig(t);
  const journalSubTabs = buildJournalSubTabs(t);
  const modeTabs = buildJournalModeTabs(t);

  const {
    mode,
    setMode,
    tab,
    setTab,
    simpleModal,
    setSimpleModal,
    nlInput,
    setNlInput,
    nlSuggestion,
    setNlSuggestion,
    showFilters,
    setShowFilters,
    modal,
    setModal,
    selected,
    setSelected,
  } = useJournalEntriesUiState({
    showDeleted,
    createRequestKey,
    canWrite,
  });

  const filterBridge = useJournalEntriesFilterBridge(filters, onFiltersChange);
  const filtered = entries;

  useEffect(() => {
    onFilteredCountChange?.(paging.total);
  }, [paging.total, onFilteredCountChange]);

  const {
    selectedIds,
    setSelectedIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAll,
    toggleSelected,
    clearSelection,
  } = useWorkSelection(filtered);

  useEffect(() => {
    onShortcutStateChange?.({
      mode,
      selectedCount: selectedIds.length,
      clearSelection,
    });
  }, [clearSelection, mode, onShortcutStateChange, selectedIds.length]);

  const wasShowDeletedRef = useRef(showDeleted);
  useEffect(() => {
    if (wasShowDeletedRef.current !== showDeleted) {
      wasShowDeletedRef.current = showDeleted;
      clearSelection();
    }
  }, [showDeleted, clearSelection]);

  const { handleNlSubmit, handleNlChange } = createJournalNlHandlers(
    nlInput,
    setNlInput,
    setNlSuggestion,
    setSimpleModal,
  );

  const { grandDebit, grandCredit } = computeJournalGrandTotals(filtered);

  const actions = useJournalEntriesActions({
    entries,
    accounts,
    filtered,
    showDeleted,
    canWrite,
    canDelete,
    t,
    formatCurrency,
    pagingTotal: paging.total,
    selectedIds,
    setSelectedIds,
    onChange,
    onDelete,
    onRestore,
    onBulkDelete,
    onBulkRestore,
    setModal,
    setSelected,
    setSimpleModal,
  });

  return {
    mode,
    setMode,
    tab,
    setTab,
    modeTabs,
    journalSubTabs,
    journalStatusConfig,
    simpleModal,
    setSimpleModal,
    nlInput,
    nlSuggestion,
    filtered,
    selectedIds,
    clearSelection,
    allVisibleSelected,
    someVisibleSelected,
    grandDebit,
    grandCredit,
    ...filterBridge,
    showFilters,
    setShowFilters,
    paging,
    modal,
    selected,
    setSelected,
    setModal,
    canWrite,
    canDelete,
    showDeleted,
    handleNlSubmit,
    handleNlChange,
    toggleSelected,
    toggleSelectAll,
    ...actions,
  };
}
