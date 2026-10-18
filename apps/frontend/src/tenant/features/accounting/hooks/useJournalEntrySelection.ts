import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { JournalEntry } from "@/lib/data/accountingData";

/** Work directory row selection SSOT for journal entries (Obligations-shaped). */
export function useJournalEntrySelection(entries: JournalEntry[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedSet = new Set(selectedIds);
  const allVisibleSelected =
    entries.length > 0 && entries.every((entry) => selectedSet.has(entry.id));
  const someVisibleSelected =
    selectedSet.size > 0 && entries.some((entry) => selectedSet.has(entry.id));

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      const visibleIds = entries.map((entry) => entry.id);
      const visibleSet = new Set(visibleIds);
      setSelectedIds((currentIds) => {
        if (checked) {
          const missing = visibleIds.filter((id) => !currentIds.includes(id));
          return missing.length === 0 ? currentIds : [...currentIds, ...missing];
        }
        const remaining = currentIds.filter((id) => !visibleSet.has(id));
        return remaining.length === currentIds.length ? currentIds : remaining;
      });
    },
    [entries],
  );

  const toggleSelectedEntry = useCallback((id: string, checked: boolean) => {
    setSelectedIds((currentIds) => {
      if (checked) {
        return currentIds.includes(id) ? currentIds : [...currentIds, id];
      }
      return currentIds.includes(id)
        ? currentIds.filter((selectedId) => selectedId !== id)
        : currentIds;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds((currentIds) => (currentIds.length === 0 ? currentIds : []));
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAll,
    toggleSelectedEntry,
    clearSelection,
  };
}

export type JournalEntrySelection = ReturnType<typeof useJournalEntrySelection>;
export type { Dispatch, SetStateAction };
