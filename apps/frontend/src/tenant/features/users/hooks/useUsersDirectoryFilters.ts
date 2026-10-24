import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";

/** Directory filters, trash, and selection SSOT for Users Work (Students-shaped). */
export function useUsersDirectoryFilters() {
  const [listPage, setListPage] = useState(1);
  const [showDeleted, setShowDeleted] = useDirectoryTrashState();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setListPage(1);
    setSelectedIds([]);
  }, [debouncedSearch, roleFilter, statusFilter, showDeleted]);

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const hasActiveFilters = Boolean(search.trim()) || roleFilter !== "all" || statusFilter !== "all";

  return {
    listPage,
    setListPage,
    showDeleted,
    setShowDeleted,
    search,
    setSearch,
    debouncedSearch,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    selectedIds,
    setSelectedIds,
    clearFilters,
    clearSelection,
    hasActiveFilters,
  };
}
