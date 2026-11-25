import { useModuleShortcuts } from "@mms/fe-core/lib/useModuleShortcuts";

/** Stable id for Students Work search — used by `/` / Cmd+K focus shortcut. */
export const STUDENTS_WORK_SEARCH_INPUT_ID = "students-work-search";

/** Students Work keyboard shortcuts — thin adapter over the shared Work hook. */
export function useStudentsKeyboardShortcuts({
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
    searchInputId: STUDENTS_WORK_SEARCH_INPUT_ID,
    selectedCount,
    hasActiveFilters,
    clearFilters,
    clearSelection,
    canWrite,
    showDeleted,
    onCreate,
  });
}
