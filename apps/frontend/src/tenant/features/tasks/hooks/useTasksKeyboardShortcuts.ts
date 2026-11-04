import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";

/** Stable id for the Tasks Work search input — used by `/` and Cmd/Ctrl+K. */
export const TASKS_WORK_SEARCH_INPUT_ID = "tasks-work-search";

/** Tasks Work keyboard shortcuts — thin adapter over the shared Work hook. */
export function useTasksKeyboardShortcuts({
  selectedCount,
  hasActiveFilters,
  clearFilters,
  clearSelection,
  canWrite,
  viewingDeleted,
  onCreate,
  enabled = true,
}: {
  selectedCount: number;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  clearSelection: () => void;
  canWrite: boolean;
  viewingDeleted: boolean;
  onCreate: () => void;
  enabled?: boolean;
}): void {
  useModuleShortcuts({
    searchInputId: TASKS_WORK_SEARCH_INPUT_ID,
    selectedCount,
    hasActiveFilters,
    clearFilters,
    clearSelection,
    canWrite,
    viewingDeleted,
    onCreate,
    enabled,
  });
}
