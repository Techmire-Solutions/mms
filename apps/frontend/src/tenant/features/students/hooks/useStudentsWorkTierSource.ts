import { STUDENTS_MODULE_MANIFEST, type StudentsBulkEnrollBody } from "@mms/shared";
import type { StudentsWorkTierSource } from "./studentsPageWorkTierProps";
import type { useStudentsDirectoryFilters } from "./useStudentsDirectoryFilters";
import type { useStudentsCrudActions } from "./useStudentsCrudActions";
import type { useStudentsPageFormState } from "./useStudentsPageFormState";
import type { useStudentsPageOverlayState } from "./useStudentsPageOverlayState";

export interface BuildStudentsWorkSourceParams {
  directory: ReturnType<typeof useStudentsDirectoryFilters>;
  formState: ReturnType<typeof useStudentsPageFormState>;
  workActions: ReturnType<typeof useStudentsCrudActions>;
  overlays: ReturnType<typeof useStudentsPageOverlayState>;
  workStudents: StudentsWorkTierSource["workStudents"];
  workPageQuery: StudentsWorkTierSource["workPageQuery"];
  useServerWork: boolean;
  viewMode: StudentsWorkTierSource["viewMode"];
  setViewMode: StudentsWorkTierSource["setViewMode"];
  columnLayout: StudentsWorkTierSource["columnLayout"];
  studentStatusOptions: StudentsWorkTierSource["studentStatusOptions"];
  genderFilters: StudentsWorkTierSource["genderFilters"];
  canWrite: boolean;
  canDelete: boolean;
  canExport: boolean;
  isFieldEnabled: (field: string) => boolean;
  selectedTargets: StudentsWorkTierSource["selectedTargets"];
  allSelected: boolean;
  someSelected: boolean;
  handleBulkExport: StudentsWorkTierSource["handleBulkExport"];
  bulkStatusPending: boolean;
}

export function buildStudentsWorkSource(
  params: BuildStudentsWorkSourceParams,
): StudentsWorkTierSource {
  const {
    directory,
    formState,
    workActions,
    overlays,
    workStudents,
    workPageQuery,
    useServerWork,
    viewMode,
    setViewMode,
    columnLayout,
    studentStatusOptions,
    genderFilters,
    canWrite,
    canDelete,
    canExport,
    isFieldEnabled,
    selectedTargets,
    allSelected,
    someSelected,
    handleBulkExport,
    bulkStatusPending,
  } = params;

  return {
    studentSearch: directory.studentSearch,
    studentFilterStatus: directory.studentFilterStatus,
    studentFilterGender: directory.studentFilterGender,
    quickFilter: directory.quickFilter,
    changeQuickFilter: directory.changeQuickFilter,
    studentStatusOptions,
    genderFilters,
    viewingDeleted: directory.viewingDeleted,
    canWrite,
    canDelete,
    canExport,
    isStatusEnabled: isFieldEnabled("status"),
    isGenderEnabled: isFieldEnabled("gender"),
    bulkActions: STUDENTS_MODULE_MANIFEST.work.bulkActions,
    workStudents,
    workPageQuery,
    useServerWork,
    viewMode,
    setViewMode,
    columnLayout,
    setStudentSearch: directory.setStudentSearch,
    toggleStudentStatus: directory.toggleStudentStatus,
    setStudentFilterGender: directory.setStudentFilterGender,
    toggleViewingDeleted: directory.toggleViewingDeleted,
    clearFilters: directory.clearFilters,
    hasActiveFilters: directory.hasActiveFilters,
    activeFilterCount: directory.activeFilterCount,
    selectedIds: directory.selectedIds,
    selectedTargets,
    allSelected,
    someSelected,
    handleSelectOne: directory.handleSelectOne,
    handleSelectAll: directory.handleSelectAll,
    clearSelection: directory.clearSelection,
    setListPage: directory.setListPage,
    openEditForm: formState.openEditForm,
    handleRestore: workActions.handleRestore,
    handleBulkStatusChange: workActions.handleBulkStatusChange,
    handleBulkEnroll: async (payload: {
      sessionIds: string[];
      mode: StudentsBulkEnrollBody["mode"];
    }) => {
      try {
        await workActions.handleBulkEnroll(directory.selectedIds, payload);
        directory.clearSelection();
      } catch {
        // Keep selection on error
      }
    },
    bulkEnrollPending: workActions.bulkEnrollPending,
    handleBulkPrintIdCards: () => {
      const selectedIdSet = new Set(directory.selectedIds);
      const selectedList = workStudents.filter((s) => selectedIdSet.has(String(s.id)));
      if (selectedList.length > 0) {
        overlays.openIdCards(selectedList);
      }
    },
    handleBulkExport,
    bulkStatusPending,
    sortField: directory.sortField,
    sortDir: directory.sortDir,
    handleServerSort: directory.handleServerSort,
    workOverlays: {
      statusBadgeConfig: overlays.statusBadgeConfig,
      openComposer: overlays.openComposer,
      openSelectionMessage: overlays.openSelectionMessage,
      canWriteMessaging: overlays.canWriteMessaging,
      setConfirmBulkDeleteOpen: overlays.setConfirmBulkDeleteOpen,
      setConfirmBulkRestoreOpen: overlays.setConfirmBulkRestoreOpen,
      setDeleteTarget: overlays.setDeleteTarget,
      setViewStudent: overlays.setViewStudent,
      openIdCards: overlays.openIdCards,
    },
  };
}
