import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import type {
  SessionSortField,
  SessionStatus,
  SessionType,
} from "@/tenant/features/sessions/lib/sessionPageTypes";

/** Directory filters, sort, and trash SSOT for Sessions Work (Teachers/Users-shaped). */
export function useSessionsDirectoryFilters() {
  const [listPage, setListPage] = useState(1);
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const [sortField, setSortField] = useState<SessionSortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [filterStatus, setFilterStatus] = useState<SessionStatus[]>([]);
  const [filterType, setFilterType] = useState<SessionType[]>([]);

  // Page 1 whenever a server-side filter/sort dimension changes (render-phase reset, no effect).
  const filterKey = `${debouncedSearch}|${filterStatus.join(",")}|${filterType.join(",")}|${showDeleted}|${sortField}|${sortDir}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setListPage(1);
  }

  const clearFilters = () => {
    setSearch("");
    setFilterStatus([]);
    setFilterType([]);
  };

  const hasActiveFilters =
    Boolean(search.trim()) || filterStatus.length > 0 || filterType.length > 0;

  return {
    listPage,
    setListPage,
    showDeleted,
    setShowDeleted,
    sortField,
    setSortField,
    sortDir,
    setSortDir,
    search,
    setSearch,
    debouncedSearch,
    filterStatus,
    setFilterStatus,
    filterType,
    setFilterType,
    clearFilters,
    hasActiveFilters,
  };
}
