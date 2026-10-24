import type { ComponentProps } from "react";
import type {
  FacultyWorkTier,
  FacultyWorkTierProps as WorkTierProps,
} from "@/tenant/features/faculty/components/FacultyWorkTier";

type FacultyWorkTierComponentProps = ComponentProps<typeof FacultyWorkTier>;

/** Inputs needed to build Work-tier props (avoids circular controller return type). */
export type FacultyWorkTierSource = {
  search: WorkTierProps["search"];
  filterStatus: WorkTierProps["filterStatus"];
  filterSpecialization: WorkTierProps["filterSpecialization"];
  filterGender: WorkTierProps["filterGender"];
  filterDepartment: WorkTierProps["filterDepartment"];
  filterDesignation: WorkTierProps["filterDesignation"];
  filterReportingFacultyId: WorkTierProps["filterReportingFacultyId"];
  quickFilter: WorkTierProps["quickFilter"];
  changeQuickFilter: WorkTierProps["onQuickFilterChange"];
  genderFilters: WorkTierProps["genderFilters"];
  activeFilterCount: WorkTierProps["activeFilterCount"];
  statusOptions: WorkTierProps["statusOptions"];
  specializationOptions: WorkTierProps["specializationOptions"];
  departmentFilterOptions: WorkTierProps["departmentFilterOptions"];
  designationFilterOptions: WorkTierProps["designationFilterOptions"];
  supervisorFilterOptions: WorkTierProps["supervisorFilterOptions"];
  showDeleted: WorkTierProps["showDeleted"];
  canWrite: WorkTierProps["canWrite"];
  canDelete: WorkTierProps["canDelete"];
  canExport: WorkTierProps["canExport"];
  hasActiveFilters: WorkTierProps["hasActiveFilters"];
  columnRegistry: WorkTierProps["columnRegistry"];
  isColumnVisible: WorkTierProps["isColumnVisible"];
  getColumnWidth: WorkTierProps["getColumnWidth"];
  onColumnResize: WorkTierProps["onColumnResize"];
  updateUserColumnLayout: WorkTierProps["updateUserColumnLayout"];
  onResetLayout: WorkTierProps["onResetLayout"];
  customizerLabels: WorkTierProps["customizerLabels"];
  faculty?: WorkTierProps["faculty"];
  workPageQuery: {
    data: WorkTierProps["workPageData"];
    isLoading: boolean;
    isError: boolean;
    isFetching: boolean;
    refetch: () => unknown;
  };
  useServerWork: WorkTierProps["useServerWork"];
  selectedIds: WorkTierProps["selectedIds"];
  handleSelectOne: WorkTierProps["onSelectOne"];
  handleSelectAll: WorkTierProps["onSelectAll"];
  clearSelection: WorkTierProps["onClearSelection"];
  handleBulkExport: WorkTierProps["onBulkExport"];
  sortField: WorkTierProps["sortField"];
  sortDir: WorkTierProps["sortDir"];
  onSortChange: WorkTierProps["onSortChange"];
  setSearch: WorkTierProps["onSearchChange"];
  toggleStatus: WorkTierProps["onToggleStatus"];
  setFilterSpecialization: WorkTierProps["onSpecializationChange"];
  setFilterGender: WorkTierProps["onGenderChange"];
  setFilterDepartment: WorkTierProps["onDepartmentChange"];
  setFilterDesignation: WorkTierProps["onDesignationChange"];
  setFilterReportingFacultyId: WorkTierProps["onReportingFacultyChange"];
  toggleViewingDeleted: WorkTierProps["onToggleDeleted"];
  clearFilters: WorkTierProps["onClearFilters"];
  onRetry: WorkTierProps["onRetry"];
  openEditForm: WorkTierProps["onEdit"];
  handleRestore: WorkTierProps["onRestore"];
  handleBulkStatusChange: WorkTierProps["onBulkStatusChange"];
  bulkStatusPending: WorkTierProps["bulkStatusPending"];
  handleBulkSpecializationChange?: WorkTierProps["onBulkSpecializationChange"];
  bulkSpecializationPending?: WorkTierProps["bulkSpecializationPending"];
  handleWhatsApp: WorkTierProps["onWhatsApp"];
  handleSms: WorkTierProps["onSms"];
  handleEmail: WorkTierProps["onEmail"];
  setListPage: WorkTierProps["onPageChange"];
  viewMode: WorkTierProps["viewMode"];
  setViewMode: WorkTierProps["onViewModeChange"];
  workOverlays: WorkTierProps["workOverlays"];
};

/** Builds Work-tier prop bag from controller/work source (Contacts-shaped composition). */
export function buildFacultyWorkTierProps(
  source: FacultyWorkTierSource,
): FacultyWorkTierComponentProps {
  const items = source.faculty ?? [];
  return {
    search: source.search,
    filterStatus: source.filterStatus,
    filterSpecialization: source.filterSpecialization,
    filterGender: source.filterGender,
    filterDepartment: source.filterDepartment,
    filterDesignation: source.filterDesignation,
    filterReportingFacultyId: source.filterReportingFacultyId,
    quickFilter: source.quickFilter,
    onQuickFilterChange: source.changeQuickFilter,
    genderFilters: source.genderFilters,
    activeFilterCount: source.activeFilterCount,
    statusOptions: source.statusOptions,
    specializationOptions: source.specializationOptions,
    departmentFilterOptions: source.departmentFilterOptions,
    designationFilterOptions: source.designationFilterOptions,
    supervisorFilterOptions: source.supervisorFilterOptions,
    showDeleted: source.showDeleted,
    canWrite: source.canWrite,
    canDelete: source.canDelete,
    canExport: source.canExport,
    hasActiveFilters: source.hasActiveFilters,
    columnRegistry: source.columnRegistry,
    isColumnVisible: source.isColumnVisible,
    getColumnWidth: source.getColumnWidth,
    onColumnResize: source.onColumnResize,
    updateUserColumnLayout: source.updateUserColumnLayout,
    onResetLayout: source.onResetLayout,
    customizerLabels: source.customizerLabels,
    faculty: items,
    workPageData: source.workPageQuery.data,
    isWorkPageLoading: source.workPageQuery.isLoading,
    isWorkPageError: source.workPageQuery.isError,
    isWorkPageFetching: source.workPageQuery.isFetching,
    useServerWork: source.useServerWork,
    selectedIds: source.selectedIds,
    onSelectOne: source.handleSelectOne,
    onSelectAll: source.handleSelectAll,
    onClearSelection: source.clearSelection,
    onBulkExport: source.handleBulkExport,
    sortField: source.sortField,
    sortDir: source.sortDir,
    onSortChange: source.onSortChange,
    onSearchChange: source.setSearch,
    onToggleStatus: source.toggleStatus,
    onSpecializationChange: source.setFilterSpecialization,
    onGenderChange: source.setFilterGender,
    onDepartmentChange: source.setFilterDepartment,
    onDesignationChange: source.setFilterDesignation,
    onReportingFacultyChange: source.setFilterReportingFacultyId,
    onToggleDeleted: source.toggleViewingDeleted,
    onClearFilters: source.clearFilters,
    onRetry: source.onRetry,
    onEdit: source.openEditForm,
    onRestore: source.handleRestore,
    onBulkStatusChange: source.handleBulkStatusChange,
    bulkStatusPending: source.bulkStatusPending,
    onBulkSpecializationChange: source.handleBulkSpecializationChange,
    bulkSpecializationPending: source.bulkSpecializationPending,
    onWhatsApp: source.handleWhatsApp,
    onSms: source.handleSms,
    onEmail: source.handleEmail,
    onPageChange: source.setListPage,
    viewMode: source.viewMode,
    onViewModeChange: source.setViewMode,
    workOverlays: source.workOverlays,
  };
}
