import type { StudentsBulkEnrollBody } from "@mms/shared";

import {
  useStudentsContractCreate,
  useStudentsContractUpdate,
  useStudentsContractDelete,
  useStudentsContractBulkDelete,
  useStudentsContractRestore,
  useStudentsContractBulkRestore,
  useStudentsContractBulkStatus,
  useStudentsContractLogExportAudit,
  useStudentsContractLogSetupAudit,
} from "@/tenant/features/students/hooks/useStudentsQueries";

/** Server mutations for Student records (create, update, delete, bulk delete, bulk status). */
export function useStudentMutations() {
  const createStudentMutation = useStudentsContractCreate();
  const updateStudentMutation = useStudentsContractUpdate();
  const deleteStudentMutation = useStudentsContractDelete();
  const bulkDeleteStudentsMutation = useStudentsContractBulkDelete();
  const restoreStudentMutation = useStudentsContractRestore();
  const bulkRestoreStudentsMutation = useStudentsContractBulkRestore();
  const bulkUpdateStudentStatusMutation = useStudentsContractBulkStatus();
  const logExportAuditMutation = useStudentsContractLogExportAudit();
  const logSetupAuditMutation = useStudentsContractLogSetupAudit();

  return {
    createStudent: createStudentMutation,
    updateStudent: updateStudentMutation,
    deleteStudent: deleteStudentMutation,
    bulkDeleteStudents: bulkDeleteStudentsMutation,
    restoreStudent: restoreStudentMutation,
    bulkRestoreStudents: bulkRestoreStudentsMutation,
    bulkUpdateStudentStatus: bulkUpdateStudentStatusMutation,
    logExportAudit: {
      mutateAsync: (payload: { count: number; scope: "all" | "filtered" | "selection" }) =>
        logExportAuditMutation.mutateAsync({ body: payload }),
      isPending: logExportAuditMutation.isPending,
    },
    logSetupAudit: {
      mutateAsync: (payload: { area: "fields" | "preferences"; summary: string }) =>
        logSetupAuditMutation.mutateAsync({ body: payload }),
      isPending: logSetupAuditMutation.isPending,
    },
  };
}

import { useStudentsContractBulkEnroll } from "@/tenant/features/students/hooks/useStudentsQueries";

/** Atomic bulk session enrollment mutation for selected students. */
export function useStudentsBulkEnrollMutation() {
  const bulkEnrollMutation = useStudentsContractBulkEnroll();

  return {
    mutateAsync: (payload: StudentsBulkEnrollBody) =>
      bulkEnrollMutation.mutateAsync({ body: payload }),
    isPending: bulkEnrollMutation.isPending,
  };
}
