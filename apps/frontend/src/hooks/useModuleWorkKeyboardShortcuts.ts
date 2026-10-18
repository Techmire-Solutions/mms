import { useEffect } from "react";
import { useModuleCreateHotkey } from "@/hooks/useModuleCreateHotkey";

export interface UseModuleWorkKeyboardShortcutsOptions {
  /** Stable DOM id of the Work SearchBar input. */
  searchInputId: string;
  /** Whether the current Work surface renders the search input. */
  searchEnabled?: boolean;
  selectedCount?: number;
  hasActiveFilters?: boolean;
  clearFilters?: () => void;
  clearSelection?: () => void;
  canWrite?: boolean;
  showDeleted?: boolean;
  viewingDeleted?: boolean;
  onCreate: () => void;
  /** When false, search/Escape/create shortcuts are inactive (e.g. other Work sub-tab). */
  enabled?: boolean;
}

/**
 * Shared Work keyboard shortcuts: focus search (`/` / Cmd+K), Escape clears
 * selection then filters, Cmd/Ctrl+N creates when writable and not in trash.
 */
export function useModuleWorkKeyboardShortcuts({
  searchInputId,
  searchEnabled = true,
  selectedCount = 0,
  hasActiveFilters = false,
  clearFilters,
  clearSelection,
  canWrite = true,
  showDeleted = false,
  viewingDeleted,
  onCreate,
  enabled = true,
}: UseModuleWorkKeyboardShortcutsOptions): void {
  const isViewingDeleted = viewingDeleted ?? showDeleted;
  useModuleCreateHotkey({
    enabled: enabled && canWrite && !isViewingDeleted,
    onCreate,
  });

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const isInputActive =
        activeTag === "input" ||
        activeTag === "textarea" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if (
        searchEnabled &&
        (event.key === "/" ||
          (event.key?.toLowerCase() === "k" && (event.metaKey || event.ctrlKey))) &&
        !isInputActive
      ) {
        event.preventDefault();
        const searchInput = document.getElementById(searchInputId) as HTMLInputElement | null;
        searchInput?.focus();
        searchInput?.select();
      } else if (event.key === "Escape") {
        if (selectedCount > 0) {
          clearSelection?.();
        } else if (hasActiveFilters) {
          clearFilters?.();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    searchEnabled,
    searchInputId,
    selectedCount,
    hasActiveFilters,
    clearFilters,
    clearSelection,
  ]);
}
