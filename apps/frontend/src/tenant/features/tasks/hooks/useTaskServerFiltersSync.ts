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
  const filters = useMemo(
    () => buildTaskServerFilters(input),
    // The input object is rebuilt each render; depend on its primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      input.quickFilter,
      input.search,
      input.statusFilter,
      input.priorityFilter,
      input.dueFrom,
      input.dueTo,
    ],
  );
  const filtersKey = JSON.stringify(filters);
  const previousKey = useRef(filtersKey);

  useEffect(() => {
    if (previousKey.current === filtersKey) return;
    previousKey.current = filtersKey;
    onFiltersChange(filters);
  }, [filters, filtersKey, onFiltersChange]);
}
