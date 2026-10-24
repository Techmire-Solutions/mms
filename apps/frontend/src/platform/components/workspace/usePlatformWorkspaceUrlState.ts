import { useSearchParams } from "react-router-dom";
import type {
  WorkspaceSortDirection,
  WorkspaceSortField,
} from "@/platform/components/platformWorkspaceListData";

export function usePlatformWorkspaceUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const statusFilter = (searchParams.get("status") as "all" | "active" | "inactive") ?? "all";
  const sortField = (searchParams.get("sort") as WorkspaceSortField) ?? "madrasaName";
  const sortDirection = (searchParams.get("dir") as WorkspaceSortDirection) ?? "asc";
  const rawPage = Number(searchParams.get("page"));
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const rawLimit = Number(searchParams.get("limit"));
  const pageSize = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 25;

  const setSearch = (v: string) =>
    setSearchParams(
      (p) => {
        if (v) {
          p.set("q", v);
        } else {
          p.delete("q");
        }
        p.delete("page");
        return p;
      },
      { replace: true },
    );

  const setStatusFilter = (v: "all" | "active" | "inactive") =>
    setSearchParams(
      (p) => {
        if (v === "all") {
          p.delete("status");
        } else {
          p.set("status", v);
        }
        p.delete("page");
        return p;
      },
      { replace: true },
    );

  const toggleSort = (field: WorkspaceSortField): void => {
    setSearchParams(
      (p) => {
        if (sortField === field) {
          p.set("dir", sortDirection === "asc" ? "desc" : "asc");
        } else {
          p.set("sort", field);
          p.set("dir", "asc");
        }
        p.delete("page");
        return p;
      },
      { replace: true },
    );
  };

  const setPage = (newPage: number): void => {
    setSearchParams(
      (p) => {
        if (newPage > 1) {
          p.set("page", String(newPage));
        } else {
          p.delete("page");
        }
        return p;
      },
      { replace: true },
    );
  };

  const setPageSize = (newLimit: number): void => {
    setSearchParams(
      (p) => {
        p.set("limit", String(newLimit));
        p.delete("page");
        return p;
      },
      { replace: true },
    );
  };

  const isFiltered = Boolean(search || statusFilter !== "all");

  const handleClearFilters = (): void => {
    setSearchParams(
      (p) => {
        p.delete("q");
        p.delete("status");
        p.delete("page");
        return p;
      },
      { replace: true },
    );
  };

  return {
    search,
    statusFilter,
    sortField,
    sortDirection,
    page,
    pageSize,
    setSearch,
    setStatusFilter,
    toggleSort,
    setPage,
    setPageSize,
    isFiltered,
    handleClearFilters,
  };
}
