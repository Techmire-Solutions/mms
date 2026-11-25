import type { FacultySortField } from "@mms/contracts";
import type { WorkDirectoryViewMode } from "@mms/fe-core/tenant";
import { useFacultyPageTabPanelProps } from "./useFacultyPageTabPanelProps";
import type { useFacultyDirectoryFilters } from "./useFacultyDirectoryFilters";
import type { useFacultyColumnLayout } from "./useFacultyColumnLayout";
import type { useFacultyWorkTierState } from "./useFacultyWorkTierState";
import type { useFacultyMutations } from "./useFaculty";
import type { useFacultyPageActions } from "./useFacultyPageActions";
import type { useFacultyPageFormState } from "./useFacultyPageFormState";
import type { useFacultyPageOverlayState } from "./useFacultyPageOverlayState";
import type { useFacultyConfig } from "./useFacultyConfig";
import type { useFacultyLookupOptions } from "./useFacultyStatusConfig";
import type { useFacultyDirectoryFilterCatalog } from "./useFacultyDirectoryFilterCatalog";

export interface UseFacultyWorkPanelPropsInput {
  effectiveTab: string;
  filters: ReturnType<typeof useFacultyDirectoryFilters>;
  filterCatalog: ReturnType<typeof useFacultyDirectoryFilterCatalog>;
  config: ReturnType<typeof useFacultyConfig>;
  lookups: ReturnType<typeof useFacultyLookupOptions>;
  columnLayout: ReturnType<typeof useFacultyColumnLayout>;
  workTierState: ReturnType<typeof useFacultyWorkTierState>;
  mutations: ReturnType<typeof useFacultyMutations>;
  pageActions: ReturnType<typeof useFacultyPageActions>;
  formState: ReturnType<typeof useFacultyPageFormState>;
  overlays: ReturnType<typeof useFacultyPageOverlayState>;
  viewMode: WorkDirectoryViewMode;
  setViewMode: (mode: WorkDirectoryViewMode) => void;
  canWrite: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export function useFacultyWorkPanelProps({
  effectiveTab,
  filters,
  filterCatalog,
  config,
  lookups,
  columnLayout,
  workTierState,
  mutations,
  pageActions,
  formState,
  overlays,
  viewMode,
  setViewMode,
  canWrite,
  canDelete,
  canExport,
}: UseFacultyWorkPanelPropsInput) {
  const { workPageQuery, workFaculty, workPageData, useServerWork, handleBulkExport } =
    workTierState;

  return useFacultyPageTabPanelProps(effectiveTab, {
    search: filters.search,
    filterStatus: filters.filterStatus,
    filterSpecialization: filters.filterSpecialization,
    filterGender: filters.filterGender,
    filterDepartment: filters.filterDepartment,
    filterDesignation: filters.filterDesignation,
    filterReportingFacultyId: filters.filterReportingFacultyId,
    quickFilter: filters.quickFilter,
    changeQuickFilter: filters.changeQuickFilter,
    genderFilters: config.genderFilters,
    activeFilterCount: filters.activeFilterCount,
    statusOptions: lookups.statusOptions,
    specializationOptions: lookups.specializationOptions,
    departmentFilterOptions: filterCatalog.departmentFilterOptions,
    designationFilterOptions: filterCatalog.designationFilterOptions,
    supervisorFilterOptions: filterCatalog.supervisorFilterOptions,
    showDeleted: filters.showDeleted,
    canWrite,
    canDelete,
    canExport,
    hasActiveFilters: filters.hasActiveFilters,
    columnRegistry: columnLayout.columnRegistry,
    isColumnVisible: columnLayout.isColumnVisible,
    getColumnWidth: columnLayout.getColumnWidth,
    onColumnResize: columnLayout.setColumnWidth,
    updateUserColumnLayout: columnLayout.updateUserColumnLayout,
    onResetLayout: columnLayout.resetColumnLayout,
    customizerLabels: columnLayout.customizerLabels,
    faculty: workFaculty,
    workPageQuery: {
      data: workPageData,
      isLoading: workPageQuery.isLoading,
      isError: workTierState.isWorkError,
      isFetching: workPageQuery.isFetching,
      refetch: () => {
        void workPageQuery.refetch();
      },
    },
    useServerWork,
    selectedIds: filters.selectedIds,
    handleSelectOne: filters.handleSelectOne,
    handleSelectAll: filters.handleSelectAll,
    clearSelection: filters.clearSelection,
    handleBulkExport,
    sortField: filters.sortField,
    sortDir: filters.sortDir,
    onSortChange: (field: FacultySortField, dir: "asc" | "desc") => {
      filters.setSortField(field);
      filters.setSortDir(dir);
    },
    setSearch: filters.setSearch,
    toggleStatus: filters.toggleStatus,
    setFilterSpecialization: filters.setFilterSpecialization,
    setFilterGender: filters.setFilterGender,
    setFilterDepartment: filters.setFilterDepartment,
    setFilterDesignation: filters.setFilterDesignation,
    setFilterReportingFacultyId: filters.setFilterReportingFacultyId,
    toggleViewingDeleted: () => filters.setShowDeleted((previous: boolean) => !previous),
    clearFilters: filters.clearFilters,
    onRetry: () => {
      void workPageQuery.refetch();
    },
    openEditForm: formState.openEdit,
    handleRestore: pageActions.handleRestore,
    handleBulkStatusChange: filters.showDeleted ? undefined : pageActions.handleBulkStatusChange,
    bulkStatusPending: mutations.bulkUpdateFacultyStatus.isPending,
    handleBulkSpecializationChange: filters.showDeleted
      ? undefined
      : pageActions.handleBulkSpecializationChange,
    bulkSpecializationPending: pageActions.isBulkSpecializationPending,
    handleWhatsApp: filters.showDeleted ? undefined : pageActions.handleWhatsApp,
    handleSms: filters.showDeleted ? undefined : pageActions.handleSms,
    handleEmail: filters.showDeleted ? undefined : pageActions.handleEmail,
    setListPage: filters.setListPage,
    viewMode,
    setViewMode,
    workOverlays: {
      openComposer: overlays.openComposer,
      openSelectionMessage: overlays.openSelectionMessage,
      canWriteMessaging: overlays.canWriteMessaging,
      setConfirmBulkDeleteOpen: overlays.setConfirmBulkDeleteOpen,
      setConfirmBulkRestoreOpen: overlays.setConfirmBulkRestoreOpen,
      setDeleteTarget: overlays.setDeleteTarget,
      setViewFaculty: overlays.setViewFaculty,
      idCardFaculty: overlays.idCardFaculty,
      openIdCardsModal: overlays.openIdCardsModal,
      closeIdCardsModal: overlays.closeIdCardsModal,
    },
  });
}
