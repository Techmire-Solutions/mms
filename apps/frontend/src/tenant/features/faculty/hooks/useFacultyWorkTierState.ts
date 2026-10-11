import { useMemo } from "react";
import {
  FACULTY_MODULE_MANIFEST,
  type FacultyMember,
  type FacultySortField,
  type FacultyQuickFilter,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { useFacultyContractList } from "@/tenant/features/faculty/hooks/useFacultyTsrHooks";
import { buildFacultyDirectoryQuery } from "@/tenant/features/faculty/hooks/facultyQueryShared";
import type { useFacultyColumnLayout } from "@/tenant/features/faculty/hooks/useFacultyColumnLayout";
import {
  resolveFacultyExportColumns,
  useFacultyExportActions,
  type UseFacultyExportActionsOptions,
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
  logExportAudit: UseFacultyExportActionsOptions["logExportAudit"];
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
  logExportAudit,
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
    logExportAudit,
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
  const isWorkError =
    workPageQuery.isError || (workPageQuery.data != null && workPageQuery.data.status !== 200);
  const workPageData = workPageQuery.data?.status === 200 ? workPageQuery.data.body : undefined;

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
