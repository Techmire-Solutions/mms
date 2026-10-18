import {
  useFacultyContractCreate,
  useFacultyContractUpdate,
  useFacultyContractDelete,
  useFacultyContractBulkDelete,
  useFacultyContractRestore,
  useFacultyContractBulkRestore,
  useFacultyContractBulkStatus,
  useFacultyContractBulkSpecialization,
  useFacultyContractLogExportAudit,
  useFacultyContractLogSetupAudit,
} from "@/tenant/features/faculty/hooks/useFacultyTsrMutations";

/** Server mutations for Faculty records (create, update, delete, bulk delete, bulk status, bulk specialization). */
export function useFacultyMutations() {
  const createFacultyMutation = useFacultyContractCreate();
  const updateFacultyMutation = useFacultyContractUpdate();
  const deleteFacultyMutation = useFacultyContractDelete();
  const bulkDeleteFacultyMutation = useFacultyContractBulkDelete();
  const restoreFacultyMutation = useFacultyContractRestore();
  const bulkRestoreFacultyMutation = useFacultyContractBulkRestore();
  const bulkUpdateFacultyStatusMutation = useFacultyContractBulkStatus();
  const bulkSpecializationMutation = useFacultyContractBulkSpecialization();
  const logExportAuditMutation = useFacultyContractLogExportAudit();
  const logSetupAuditMutation = useFacultyContractLogSetupAudit();

  return {
    createFaculty: createFacultyMutation,
    updateFaculty: updateFacultyMutation,
    deleteFaculty: deleteFacultyMutation,
    bulkDeleteFaculty: bulkDeleteFacultyMutation,
    restoreFaculty: restoreFacultyMutation,
    bulkRestoreFaculty: bulkRestoreFacultyMutation,
    bulkUpdateFacultyStatus: bulkUpdateFacultyStatusMutation,
    bulkUpdateFacultySpecialization: bulkSpecializationMutation.mutateAsync,
    isBulkSpecializationPending: bulkSpecializationMutation.isPending,
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
