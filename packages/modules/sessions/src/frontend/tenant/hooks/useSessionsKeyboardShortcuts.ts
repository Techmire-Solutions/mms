import { useModuleShortcuts } from "@mms/fe-core/lib/useModuleShortcuts";

/** Stable id for Sessions Work search — used by `/` / Cmd+K focus shortcut. */
export const SESSIONS_WORK_SEARCH_INPUT_ID = "sessions-work-search";

/** Sessions Work keyboard shortcuts — thin adapter over the shared Work hook. */
export function useSessionsKeyboardShortcuts({
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
    searchInputId: SESSIONS_WORK_SEARCH_INPUT_ID,
    selectedCount,
    hasActiveFilters,
    clearFilters,
    clearSelection,
    canWrite,
    showDeleted,
    onCreate,
  });
}
