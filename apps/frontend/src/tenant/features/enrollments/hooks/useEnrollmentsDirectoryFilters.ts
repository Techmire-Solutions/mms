import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";

/** Directory filters and trash SSOT for Enrollments Work. */
export function useEnrollmentsDirectoryFilters() {
  const [listPage, setListPage] = useState(1);
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("all");

  useEffect(() => {
    setListPage(1);
  }, [debouncedSearch, statusFilter, sessionFilter, showDeleted]);

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
