import type { Student } from "@mms/shared";
import type { StudentsPageOverlaysProps } from "@/tenant/features/students/hooks/studentsPageOverlaysTypes";
import type { useStudentsPageFormState } from "@/tenant/features/students/hooks/useStudentsPageFormState";
import type { useStudentsCrudActions } from "@/tenant/features/students/hooks/useStudentsCrudActions";
import type { useStudentsPageOverlayState } from "@/tenant/features/students/hooks/useStudentsPageOverlayState";

type FormState = ReturnType<typeof useStudentsPageFormState>;
type WorkOverlays = ReturnType<typeof useStudentsPageOverlayState>;
type WorkActions = ReturnType<typeof useStudentsCrudActions>;

/** Maps form / overlay / action slices into StudentsPageOverlaysProps (Contacts-shaped). */
export function useStudentsPageOverlayProps({
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
    | "handleSaveStudent"
    | "handleRestore"
    | "handleDelete"
    | "handleBulkDelete"
    | "handleBulkRestore"
  >;
  selectedIds: string[];
  clearSelection: () => void;
}): StudentsPageOverlaysProps {
  return {
    showStudentForm: formState.showStudentForm,
    editStudent: formState.editStudent,
    onCloseForm: formState.closeStudentForm,
    onSave: async (student: Student) => {
      const savedStudent = await workActions.handleSaveStudent(student);
      if (!formState.editStudent && savedStudent) {
        formState.setEditStudent(savedStudent);
      }
    },
    viewStudent: overlays.viewStudent,
    onCloseView: () => overlays.setViewStudent(null),
    onEditFromDrawer: (student: Student) => {
      overlays.setViewStudent(null);
      formState.openEditForm(student);
    },
    onRestoreFromDrawer: canDelete
      ? async (studentId) => {
          try {
            await workActions.handleRestore(studentId);
            overlays.setViewStudent(null);
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
    idCardStudents: overlays.idCardStudents,
    onCloseIdCards: overlays.closeIdCards,
    onPrintIdCard: (student: Student) => overlays.openIdCards([student]),
    onViewStudent: (student: Student) => overlays.setViewStudent(student),
  };
}
