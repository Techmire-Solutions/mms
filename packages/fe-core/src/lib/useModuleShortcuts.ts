import {
  useModuleWorkKeyboardShortcuts,
  type UseModuleWorkKeyboardShortcutsOptions,
} from "./useModuleWorkKeyboardShortcuts.js";

export type UseModuleShortcutsOptions = UseModuleWorkKeyboardShortcutsOptions;

/**
 * Universal keyboard shortcut engine for 3-tier modules.
 * Standardizes `/` or `Cmd+K` for search focus, `Escape` for deselect/clear-filters,
 * and `Cmd/Ctrl+N` for new record creation.
 */
export function useModuleShortcuts(options: UseModuleShortcutsOptions): void {
  useModuleWorkKeyboardShortcuts(options);
}
