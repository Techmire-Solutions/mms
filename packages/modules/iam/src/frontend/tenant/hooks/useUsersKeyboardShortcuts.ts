import { useModuleShortcuts } from "@mms/fe-core/lib/useModuleShortcuts";

/** Stable id for Users Work search — used by `/` / Cmd+K focus shortcut. */
export const USERS_WORK_SEARCH_INPUT_ID = "users-work-search";

/** Users Work keyboard shortcuts — thin adapter over the shared Work hook. */
export function useUsersKeyboardShortcuts({
  enabled,
  selectedCount,
  hasActiveFilters,
  clearFilters,
  clearSelection,
  canWrite,
  showDeleted,
  onCreate,
}: {
  enabled: boolean;
  selectedCount: number;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  clearSelection: () => void;
  canWrite: boolean;
  showDeleted: boolean;
  onCreate: () => void;
}): void {
  useModuleShortcuts({
    enabled,
    searchInputId: USERS_WORK_SEARCH_INPUT_ID,
    selectedCount,
    hasActiveFilters,
    clearFilters,
    clearSelection,
    canWrite,
    showDeleted,
    onCreate,
  });
}
