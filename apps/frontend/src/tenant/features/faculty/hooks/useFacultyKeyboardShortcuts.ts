import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";

/** Stable id for Faculty Work search — used by `/` / Cmd+K focus shortcut. */
export const FACULTY_WORK_SEARCH_INPUT_ID = "faculty-work-search";

/** Faculty Work keyboard shortcuts — thin adapter over the shared Work hook. */
export function useFacultyKeyboardShortcuts({
  selectedCount,
  hasActiveFilters,
  clearFilters,
  clearSelection,
  canWrite,
  showDeleted,
  onCreate,
}: {
  selectedCount: number;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  clearSelection: () => void;
  canWrite: boolean;
  showDeleted: boolean;
  onCreate: () => void;
}): void {
  useModuleShortcuts({
    searchInputId: FACULTY_WORK_SEARCH_INPUT_ID,
    selectedCount,
    hasActiveFilters,
    clearFilters,
    clearSelection,
    canWrite,
    showDeleted,
    onCreate,
  });
}
