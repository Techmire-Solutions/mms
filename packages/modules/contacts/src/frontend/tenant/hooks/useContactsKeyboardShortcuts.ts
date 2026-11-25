import { useModuleShortcuts } from "@mms/fe-core/lib/useModuleShortcuts";

/** Stable id for Contacts Work search — used by `/` / Cmd+K focus shortcut. */
export const CONTACTS_WORK_SEARCH_INPUT_ID = "contacts-work-search";

export interface UseContactsKeyboardShortcutsOptions {
  selectedCount: number;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  clearSelection: () => void;
  canWrite: boolean;
  viewingDeleted: boolean;
  onCreate: () => void;
}

/** Contacts Work keyboard shortcuts — thin adapter over the shared Work hook. */
export function useContactsKeyboardShortcuts({
  selectedCount,
  hasActiveFilters,
  clearFilters,
  clearSelection,
  canWrite,
  viewingDeleted,
  onCreate,
}: UseContactsKeyboardShortcutsOptions): void {
  useModuleShortcuts({
    searchInputId: CONTACTS_WORK_SEARCH_INPUT_ID,
    selectedCount,
    hasActiveFilters,
    clearFilters,
    clearSelection,
    canWrite,
    showDeleted: viewingDeleted,
    onCreate,
  });
}
