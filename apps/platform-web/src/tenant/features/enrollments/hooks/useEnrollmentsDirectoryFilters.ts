import { useState } from "react";
import { useDebounce } from "@mms/fe-core/hooks";
import { useDirectoryTrashState } from "@mms/fe-core/lib/useDirectoryTrashState";
import { useIdentityReset } from "@mms/fe-core/forms/useIdentityReset";

/** Directory filters and trash SSOT for Enrollments Work. */
export function useEnrollmentsDirectoryFilters() {
  const [listPage, setListPage] = useState(1);
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("all");

  // Page 1 whenever a server-side filter dimension changes (render-phase reset, no effect).
  const filterKey = `${debouncedSearch}|${statusFilter}|${sessionFilter}|${showDeleted}`;
  useIdentityReset(filterKey, () => setListPage(1));

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSessionFilter("all");
  };

  const hasActiveFilters =
    Boolean(search.trim()) || statusFilter !== "all" || sessionFilter !== "all";

  return {
    listPage,
    setListPage,
    showDeleted,
    setShowDeleted,
    search,
    setSearch,
    debouncedSearch,
    statusFilter,
    setStatusFilter,
    sessionFilter,
    setSessionFilter,
    clearFilters,
    hasActiveFilters,
  };
}
