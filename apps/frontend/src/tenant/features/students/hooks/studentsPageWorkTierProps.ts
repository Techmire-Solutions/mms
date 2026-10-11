import type { ComponentProps } from "react";
import type { StudentsWorkTier } from "@/tenant/features/students/components/StudentsWorkTier";
import type { StudentsWorkTierProps as WorkTierProps } from "@/tenant/features/students/components/studentsWorkTierTypes";

type StudentsWorkTierProps = ComponentProps<typeof StudentsWorkTier>;

/** Inputs needed to build Work-tier props (avoids circular controller return type). */
export type StudentsWorkTierSource = {
  studentSearch: WorkTierProps["studentSearch"];
  studentFilterStatus: WorkTierProps["studentFilterStatus"];
  studentFilterGender: WorkTierProps["studentFilterGender"];
  quickFilter: WorkTierProps["quickFilter"];
  changeQuickFilter: WorkTierProps["onQuickFilterChange"];
  studentStatusOptions: WorkTierProps["studentStatusOptions"];
  genderFilters: WorkTierProps["genderFilters"];
  viewingDeleted: WorkTierProps["viewingDeleted"];
  canWrite: WorkTierProps["canWrite"];
  canDelete: WorkTierProps["canDelete"];
  canExport: WorkTierProps["canExport"];
  isStatusEnabled?: WorkTierProps["isStatusEnabled"];
  isGenderEnabled?: WorkTierProps["isGenderEnabled"];
  bulkActions: WorkTierProps["bulkActions"];
  workStudents: WorkTierProps["workStudents"];
  workPageQuery: {
    data: WorkTierProps["workPageData"];
    isLoading: boolean;
    isError: boolean;
    isFetching: boolean;
    refetch: () => unknown;
  };
  useServerWork: WorkTierProps["useServerWork"];
  viewMode: WorkTierProps["viewMode"];
  setViewMode: WorkTierProps["onViewModeChange"];
  columnLayout: WorkTierProps["columnLayout"];
  setStudentSearch: WorkTierProps["onSearchChange"];
  toggleStudentStatus: WorkTierProps["onToggleStatus"];
  setStudentFilterGender: WorkTierProps["onGenderChange"];
  toggleViewingDeleted: WorkTierProps["onToggleDeleted"];
  clearFilters: WorkTierProps["onClearFilters"];
  hasActiveFilters: WorkTierProps["hasActiveFilters"];
  activeFilterCount: WorkTierProps["activeFilterCount"];
  selectedIds: WorkTierProps["selectedIds"];
  selectedTargets: WorkTierProps["selectedTargets"];
  allSelected: WorkTierProps["allSelected"];
  someSelected: WorkTierProps["someSelected"];
  handleSelectOne: WorkTierProps["onSelectOne"];
  handleSelectAll: WorkTierProps["onSelectAll"];
  clearSelection: WorkTierProps["onClearSelection"];
  setListPage: WorkTierProps["onPageChange"];
  openEditForm: WorkTierProps["onEdit"];
  handleRestore: WorkTierProps["onRestore"];
  handleBulkStatusChange: WorkTierProps["onBulkStatusChange"];
  handleBulkEnroll?: WorkTierProps["onBulkEnroll"];
  bulkEnrollPending?: WorkTierProps["bulkEnrollPending"];
  handleBulkPrintIdCards?: WorkTierProps["onBulkPrintIdCards"];
  handleBulkExport: WorkTierProps["onBulkExport"];
  bulkStatusPending: WorkTierProps["bulkStatusPending"];
  sortField: WorkTierProps["sortField"];
  sortDir: WorkTierProps["sortDir"];
  handleServerSort: WorkTierProps["onServerSort"];
  workOverlays: WorkTierProps["workOverlays"];
};

/** Builds Work-tier prop bag from controller/work source (Contacts-shaped composition). */
export function buildStudentsWorkTierProps(source: StudentsWorkTierSource): StudentsWorkTierProps {
  return {
    studentSearch: source.studentSearch,
    studentFilterStatus: source.studentFilterStatus,
    studentFilterGender: source.studentFilterGender,
    quickFilter: source.quickFilter,
    onQuickFilterChange: source.changeQuickFilter,
    studentStatusOptions: source.studentStatusOptions,
    genderFilters: source.genderFilters,
    viewingDeleted: source.viewingDeleted,
    canWrite: source.canWrite,
    canDelete: source.canDelete,
    canExport: source.canExport,
    isStatusEnabled: source.isStatusEnabled,
    isGenderEnabled: source.isGenderEnabled,
    bulkActions: source.bulkActions,
    workStudents: source.workStudents,
    workPageData: source.workPageQuery.data,
    isWorkPageLoading: source.workPageQuery.isLoading,
    isWorkPageError: source.workPageQuery.isError,
    isWorkPageFetching: source.workPageQuery.isFetching,
    useServerWork: source.useServerWork,
    viewMode: source.viewMode,
    onViewModeChange: source.setViewMode,
    columnLayout: source.columnLayout,
    onSearchChange: source.setStudentSearch,
    onToggleStatus: source.toggleStudentStatus,
    onGenderChange: source.setStudentFilterGender,
    onToggleDeleted: source.toggleViewingDeleted,
    onClearFilters: source.clearFilters,
    hasActiveFilters: source.hasActiveFilters,
    activeFilterCount: source.activeFilterCount,
    selectedIds: source.selectedIds,
    selectedTargets: source.selectedTargets,
    allSelected: source.allSelected,
    someSelected: source.someSelected,
    onSelectOne: source.handleSelectOne,
    onSelectAll: source.handleSelectAll,
    onClearSelection: source.clearSelection,
    onRetry: () => {
      void source.workPageQuery.refetch();
    },
    onPageChange: source.setListPage,
    onEdit: source.openEditForm,
    onRestore: source.handleRestore,
    onBulkStatusChange: source.handleBulkStatusChange,
    onBulkEnroll: source.handleBulkEnroll,
    bulkEnrollPending: source.bulkEnrollPending,
    onBulkPrintIdCards: source.handleBulkPrintIdCards,
    onBulkExport: source.handleBulkExport,
    bulkStatusPending: source.bulkStatusPending,
    sortField: source.sortField,
    sortDir: source.sortDir,
    onServerSort: source.handleServerSort,
    workOverlays: source.workOverlays,
  };
}
