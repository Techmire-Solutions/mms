import { useCallback } from "react";
import { type Student, type StudentsBulkEnrollPlacement } from "@mms/shared";
import {
  type useStudentMutations,
  type StudentRecord,
} from "@/tenant/features/students/hooks/useStudents";
import { useStudentsBulkEnrollMutation } from "@/tenant/features/students/hooks/useStudentMutations";
import { useStudentsCrudNotify } from "@/tenant/features/students/hooks/useStudentsCrudNotify";

/** Mutate + notify wrappers for Students Work (Contacts-shaped action cluster). */
export function useStudentsCrudActions({
  editStudent,
  mutations,
}: {
  editStudent: Student | null;
  mutations: ReturnType<typeof useStudentMutations>;
}) {
  const { handleError, notifyBulkResult, notifyArchivedWithUndo } = useStudentsCrudNotify();
  const bulkEnrollMutation = useStudentsBulkEnrollMutation();
  const {
    deleteStudent,
    bulkDeleteStudents,
    restoreStudent,
    bulkRestoreStudents,
    bulkUpdateStudentStatus,
    createStudent,
    updateStudent,
  } = mutations;

  const handleSaveStudent = useCallback(
    async (studentToSave: Student): Promise<Student> => {
      if (editStudent) {
        const res = await updateStudent.mutateAsync({
          params: { id: String(studentToSave.id) },
          body: studentToSave as StudentRecord,
        });
        return ((res.body as { student?: Student })?.student ?? res.body) as Student;
      } else {
        const res = await createStudent.mutateAsync({
          body: studentToSave as StudentRecord,
        });
        return ((res.body as { student?: Student })?.student ?? res.body) as Student;
      }
    },
    [editStudent, updateStudent, createStudent],
  );

  const handleRestore = useCallback(
    async (studentId: string): Promise<void> => {
      try {
        await restoreStudent.mutateAsync({ params: { id: String(studentId) }, body: {} });
        notifyBulkResult(1, 0, "students.restoreSuccess", "students.bulkRestoreSuccess");
      } catch (error) {
        handleError(error, "students.restore", "students.restoreFailed");
        throw error;
      }
    },
    [restoreStudent, notifyBulkResult, handleError],
  );

  const handleDelete = useCallback(
    async (studentId: string, deletionReason?: string): Promise<void> => {
      try {
        await deleteStudent.mutateAsync({
          params: { id: String(studentId) },
          body: { deletionReason },
        });
        notifyArchivedWithUndo(() => handleRestore(studentId));
      } catch (error) {
        handleError(error, "students.delete", "students.deleteFailed");
      }
    },
    [deleteStudent, handleRestore, notifyArchivedWithUndo, handleError],
  );

  const handleBulkDelete = useCallback(
    async (studentIds: string[], deletionReason?: string): Promise<void> => {
      try {
        const result = await bulkDeleteStudents.mutateAsync({
          body: { ids: studentIds.map(String), deletionReason },
        });
        notifyBulkResult(
          result.body.succeeded,
          result.body.failed,
          "students.deleteSuccess",
          "students.bulkDeleteSuccess",
        );
      } catch (error) {
        handleError(error, "students.bulk_delete", "students.deleteFailed");
      }
    },
    [bulkDeleteStudents, notifyBulkResult, handleError],
  );

  const handleBulkRestore = useCallback(
    async (studentIds: string[]): Promise<void> => {
      try {
        const result = await bulkRestoreStudents.mutateAsync({
          body: { ids: studentIds.map(String) },
        });
        notifyBulkResult(
          result.body.succeeded,
          result.body.failed,
          "students.restoreSuccess",
          "students.bulkRestoreSuccess",
        );
      } catch (error) {
        handleError(error, "students.bulk_restore", "students.restoreFailed");
      }
    },
    [bulkRestoreStudents, notifyBulkResult, handleError],
  );

  const handleBulkStatusChange = useCallback(
    async (studentIds: string[], status: string): Promise<void> => {
      try {
        const result = await bulkUpdateStudentStatus.mutateAsync({
          body: { ids: studentIds.map(String), status },
        });
        notifyBulkResult(
          result.body.succeeded,
          result.body.failed,
          "students.bulkStatusSuccess",
          "students.bulkStatusSuccessMany",
        );
      } catch (error) {
        handleError(error, "students.bulk_status", "students.bulkStatusFailed");
        throw error;
      }
    },
    [bulkUpdateStudentStatus, notifyBulkResult, handleError],
  );

  const handleBulkEnroll = useCallback(
    async (studentIds: string[], payload: StudentsBulkEnrollPlacement): Promise<void> => {
      try {
        const result = await bulkEnrollMutation.mutateAsync({ studentIds, ...payload });
        const resBody =
          (result as { body?: { succeeded?: number; failed?: number } }).body ?? result;
        notifyBulkResult(
          resBody.succeeded ?? 0,
          resBody.failed ?? 0,
          "students.bulkEnrollSuccess",
          "students.bulkEnrollSuccess",
        );
      } catch (error) {
        handleError(error, "students.bulk_enroll", "students.saveFailed");
        throw error;
      }
    },
    [bulkEnrollMutation, notifyBulkResult, handleError],
  );

  return {
    handleSaveStudent,
    handleDelete,
    handleRestore,
    handleBulkDelete,
    handleBulkRestore,
    handleBulkStatusChange,
    handleBulkEnroll,
    bulkEnrollPending: bulkEnrollMutation.isPending,
  };
}
