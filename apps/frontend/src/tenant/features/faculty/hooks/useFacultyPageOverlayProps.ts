import type { Faculty } from "@mms/shared";
import type { FacultyPageOverlaysProps } from "@/tenant/features/faculty/hooks/facultyPageOverlaysTypes";
import type { useFacultyPageFormState } from "@/tenant/features/faculty/hooks/useFacultyPageFormState";
import type { useFacultyPageOverlayState } from "@/tenant/features/faculty/hooks/useFacultyPageOverlayState";
import type { useFacultyPageActions } from "@/tenant/features/faculty/hooks/useFacultyPageActions";

type FormState = ReturnType<typeof useFacultyPageFormState>;
type WorkOverlays = ReturnType<typeof useFacultyPageOverlayState>;
type WorkActions = ReturnType<typeof useFacultyPageActions>;

/** Maps form / overlay / action slices into FacultyPageOverlaysProps (Contacts-shaped). */
export function useFacultyPageOverlayProps({
  canWrite,
  canDelete,
  formState,
  overlays,
  workActions,
  selectedIds,
  clearSelection,
}: {
  canWrite: boolean;
  canDelete: boolean;
  formState: FormState;
  overlays: WorkOverlays;
  workActions: Pick<
    WorkActions,
    "handleRestore" | "handleDelete" | "handleBulkDelete" | "handleBulkRestore"
  > & {
    handleSaveFaculty?: WorkActions["handleSaveFaculty"];
    onReportingFacultyChange?: (supervisorId: string) => void;
  };

  selectedIds: string[];
  clearSelection: () => void;
}): FacultyPageOverlaysProps {
  const saveFn = workActions.handleSaveFaculty;
  const currentEdit = formState.editFaculty ?? null;
  const currentView = overlays.viewFaculty ?? null;

  return {
    showForm: formState.showForm,
    editFaculty: formState.editFaculty,
    onCloseForm: formState.close,
    onSave: async (faculty: Faculty) => {
      if (!saveFn) return;
      const saved = await saveFn(faculty);
      if (!currentEdit && saved) {
        formState.setEditFaculty?.(saved);
      }
    },
    viewFaculty: currentView,
    onCloseView: () => overlays.setViewFaculty(null),
    onFilterSubordinates: (facultyId: string) => {
      overlays.setViewFaculty(null);
      workActions.onReportingFacultyChange?.(facultyId);
    },
    onEditFromDrawer: (faculty: Faculty) => {
      overlays.setViewFaculty(null);
      formState.openEdit(faculty);
    },
    onRestoreFromDrawer: canDelete
      ? async (facultyId) => {
          try {
            await workActions.handleRestore(facultyId);
            overlays.setViewFaculty(null);
          } catch {
            // Keep drawer open so the user can retry after a failed restore.
          }
        }
      : undefined,
    messagingTarget: overlays.messagingTarget,
    onCloseComposer: overlays.closeComposer,
    openComposer: overlays.openComposer,
    canWriteMessaging: overlays.canWriteMessaging,
    canWrite,
    canDelete,
    bulkDeleteOpen: overlays.confirmBulkDeleteOpen,
    onBulkDeleteOpenChange: overlays.setConfirmBulkDeleteOpen,
    selectedCount: selectedIds.length,
    onConfirmBulkDelete: async (reason) => {
      await workActions.handleBulkDelete(selectedIds, reason);
      clearSelection();
    },
    deleteTarget: overlays.deleteTarget,
    onDeleteTargetOpenChange: (open) => {
      if (!open) overlays.setDeleteTarget(null);
    },
    onConfirmSingleDelete: async (reason) => {
      if (!overlays.deleteTarget) return;
      await workActions.handleDelete(String(overlays.deleteTarget.id), reason);
      overlays.setDeleteTarget(null);
    },
    bulkRestoreOpen: overlays.confirmBulkRestoreOpen,
    onBulkRestoreOpenChange: overlays.setConfirmBulkRestoreOpen,
    onConfirmBulkRestore: async () => {
      await workActions.handleBulkRestore(selectedIds);
      clearSelection();
    },
    idCardFaculty: overlays.idCardFaculty,
    onCloseIdCards: overlays.closeIdCardsModal,
    onPrintIdCard: (faculty: Faculty) => overlays.openIdCardsModal([faculty]),
    createDepartmentOpen: overlays.createDepartmentOpen,
    onCloseCreateDepartment: () => overlays.setCreateDepartmentOpen(false),
    createDesignationOpen: overlays.createDesignationOpen,
    onCloseCreateDesignation: () => overlays.setCreateDesignationOpen(false),
    importEntity: overlays.importEntity,
    onCloseImport: () => overlays.setImportEntity(null),
  };
}
