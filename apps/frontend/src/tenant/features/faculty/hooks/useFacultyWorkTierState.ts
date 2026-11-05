import { useMemo } from "react";
import {
  FACULTY_MODULE_MANIFEST,
  type FacultyMember,
  type FacultySortField,
  type FacultyQuickFilter,
} from "@mms/shared";
import { contractBody, isContractQueryError } from "@/lib/contractQuery";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { useFacultyContractList } from "@/tenant/features/faculty/hooks/useFacultyTsrQueries";
import { buildFacultyDirectoryQuery } from "@/tenant/features/faculty/hooks/facultyQueryShared";
import type { useFacultyColumnLayout } from "@/tenant/features/faculty/hooks/useFacultyColumnLayout";
import {
  resolveFacultyExportColumns,
  useFacultyExportActions,
} from "@/tenant/features/faculty/hooks/useFacultyExportActions";

export interface UseFacultyWorkTierStateInput {
  effectiveTab: string;
  listPage: number;
  debouncedSearch: string;
  filterStatus: string[];
  filterSpecialization: string;
  filterGender: string;
  filterDepartment: string;
  filterDesignation: string;
  filterReportingFacultyId: string;
  quickFilter: FacultyQuickFilter;
  sortField: FacultySortField;
  sortDir: "asc" | "desc";
  showDeleted: boolean;
  columnLayout: ReturnType<typeof useFacultyColumnLayout>;
  canExport: boolean;
  hasActiveFilters: boolean;
  selectedIds: string[];
  t: TranslationFunction;
}

export function useFacultyWorkTierState({
  effectiveTab,
  listPage,
  debouncedSearch,
  filterStatus,
  filterSpecialization,
  filterGender,
  filterDepartment,
  filterDesignation,
  filterReportingFacultyId,
  quickFilter,
  sortField,
  sortDir,
  showDeleted,
  columnLayout,
  canExport,
  hasActiveFilters,
  selectedIds,
  t,
}: UseFacultyWorkTierStateInput) {
  const exportColumns = useMemo(
    () => resolveFacultyExportColumns(columnLayout.columnRegistry, columnLayout.isColumnVisible, t),
    [columnLayout.columnRegistry, columnLayout.isColumnVisible, t],
  );

  const { handleExportCSV, handleBulkExport } = useFacultyExportActions({
    tableColumns: exportColumns,
    canExport,
    search: debouncedSearch,
    filterStatus,
    filterSpecialization,
    filterGender,
    filterDepartment,
    filterDesignation,
    filterReportingFacultyId,
    quickFilter,
    sortField,
    sortDir,
    viewingDeleted: showDeleted,
    hasActiveFilters,
    selectedIds,
  });

  const useServerWork = effectiveTab === "faculties";
  const workPageQuery = useFacultyContractList(
    {
      page: listPage,
      limit: FACULTY_MODULE_MANIFEST.defaultPageSize,
      ...buildFacultyDirectoryQuery({
        search: debouncedSearch,
        filterStatus,
        filterSpecialization,
        filterGender,
        filterDepartment,
        filterDesignation,
        filterReportingFacultyId,
        quickFilter,
        sortField,
        sortDir,
      }),
      includeDeleted: showDeleted,
    },
    useServerWork,
  );

  const workFaculty = (workPageQuery.data?.body?.faculty ?? []) as FacultyMember[];
  const shownCount = workPageQuery.data?.body?.total ?? workFaculty.length;
  const isWorkError = isContractQueryError(workPageQuery);
  const workPageData = contractBody<NonNullable<typeof workPageQuery.data>["body"]>(
    workPageQuery.data ?? undefined,
  );

  return {
    useServerWork,
    workPageQuery,
    workFaculty,
    shownCount,
    isWorkError,
    workPageData,
    handleExportCSV,
    handleBulkExport,
  };
}
