import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Controller-owned Work directory row selection SSOT.
 *
 * Lists may pass their visible items to get list-bound select-all plus the
 * derived all/some-visible flags, or pass visible ids explicitly to
 * `toggleSelectAll(checked, ids)`. All callbacks are referentially stable.
 */
export function useWorkSelection<T extends string | number = string>(
  visibleItems?: readonly { id: T }[],
) {
  const [selectedIds, setSelectedIds] = useState<T[]>([]);

  const visibleIds = visibleItems ? visibleItems.map((item) => item.id) : [];
  const visibleIdsRef = useRef<T[]>(visibleIds);
  visibleIdsRef.current = visibleIds;

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected =
    visibleIds.length > 0 && visibleIds.some((id) => selectedIds.includes(id));

  const toggleSelected = useCallback((id: T, checked: boolean) => {
    setSelectedIds((current) =>
      checked
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((selectedId) => selectedId !== id),
    );
  }, []);

  const toggleSelectAll = useCallback((checked: boolean, ids?: T[]) => {
    const targetIds = ids ?? visibleIdsRef.current;
    const targetSet = new Set(targetIds);
    setSelectedIds((current) => {
      if (checked) {
        const missing = targetIds.filter((id) => !current.includes(id));
        return missing.length === 0 ? current : [...current, ...missing];
      }
      const remaining = current.filter((id) => !targetSet.has(id));
      return remaining.length === current.length ? current : remaining;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds((current) => (current.length === 0 ? current : []));
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    visibleIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
  };
}

export type WorkSelection<T extends string | number = string> = ReturnType<
  typeof useWorkSelection<T>
>;
export type { Dispatch, SetStateAction };
