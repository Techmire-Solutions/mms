import { useState, type Dispatch, type SetStateAction } from "react";
import type { Session } from "@/lib/data/sessionsData";

export function useSessionsSelection(sessions: Session[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedSet = new Set(selectedIds);
  const allVisibleSelected =
    sessions.length > 0 && sessions.every((sessionItem) => selectedSet.has(sessionItem.id));
  const someVisibleSelected =
    selectedSet.size > 0 && sessions.some((sessionItem) => selectedSet.has(sessionItem.id));

  const toggleSelectAll = (checked: boolean) => {
    const visibleIds = sessions.map((sessionItem) => sessionItem.id);
    const visibleSet = new Set(visibleIds);
    setSelectedIds((currentIds) =>
      checked
        ? [...new Set([...currentIds, ...visibleIds])]
        : currentIds.filter((id) => !visibleSet.has(id)),
    );
  };

  const toggleSelectedSession = (id: string, checked: boolean) => {
    setSelectedIds((currentIds) =>
      checked ? [...currentIds, id] : currentIds.filter((selectedId) => selectedId !== id),
    );
  };

  const clearSelection = () => setSelectedIds([]);

  return {
    selectedIds,
    setSelectedIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAll,
    toggleSelectedSession,
    clearSelection,
  };
}

export function toggleFilterValue<T>(
  selectedValues: T[],
  setSelectedValues: Dispatch<SetStateAction<T[]>>,
  nextValue: T,
): void {
  setSelectedValues((currentValues) =>
    currentValues.includes(nextValue)
      ? currentValues.filter((value) => value !== nextValue)
      : [...currentValues, nextValue],
  );
}
