import { useEffect, useMemo, useRef } from "react";
import {
  buildTaskServerFilters,
  type TaskServerFilterInput,
  type TaskServerFilters,
} from "../lib/tasksServerFilters";

/**
 * Reports the mapped server filters to the directory owner whenever the client
 * filter model changes. The first render is a no-op: the owner already starts
 * with an empty filter set.
 */
export function useTaskServerFiltersSync(
  input: TaskServerFilterInput,
  onFiltersChange: (filters: TaskServerFilters) => void,
): void {
  // Destructure once so the memo depends on exactly the primitives it reads —
  // no exhaustive-deps suppression, and the input object can be rebuilt per
  // render without retriggering the derivation.
  const { quickFilter, search, statusFilter, priorityFilter, dueFrom, dueTo, currentUserId } =
    input;
  const filters = useMemo(
    () =>
      buildTaskServerFilters({
        quickFilter,
        search,
        statusFilter,
        priorityFilter,
        dueFrom,
        dueTo,
        currentUserId,
      }),
    [quickFilter, search, statusFilter, priorityFilter, dueFrom, dueTo, currentUserId],
  );
  const filtersKey = JSON.stringify(filters);
  const previousKey = useRef(filtersKey);

  useEffect(() => {
    if (previousKey.current === filtersKey) return;
    previousKey.current = filtersKey;
    onFiltersChange(filters);
  }, [filters, filtersKey, onFiltersChange]);
}
