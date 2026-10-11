import type { FacultySortField } from "@mms/shared";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useFacultyPageTabPanelProps } from "@/tenant/features/faculty/hooks/useFacultyPageTabPanelProps";
import type { useFacultyDirectoryFilters } from "@/tenant/features/faculty/hooks/useFacultyDirectoryFilters";
import type { useFacultyColumnLayout } from "@/tenant/features/faculty/hooks/useFacultyColumnLayout";
import type { useFacultyWorkTierState } from "@/tenant/features/faculty/hooks/useFacultyWorkTierState";
import type { useFacultyMutations } from "@/tenant/features/faculty/hooks/useFaculty";
import type { useFacultyPageActions } from "@/tenant/features/faculty/hooks/useFacultyPageActions";
import type { useFacultyPageFormState } from "@/tenant/features/faculty/hooks/useFacultyPageFormState";
import type { useFacultyPageOverlayState } from "@/tenant/features/faculty/hooks/useFacultyPageOverlayState";
import type { useFacultyConfig } from "@/hooks/useStandardModuleConfig";
import type { useFacultyLookupOptions } from "@/tenant/features/faculty/hooks/useFacultyStatusConfig";
import type { useFacultyDirectoryFilterCatalog } from "@/tenant/features/faculty/hooks/useFacultyDirectoryFilterCatalog";

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
