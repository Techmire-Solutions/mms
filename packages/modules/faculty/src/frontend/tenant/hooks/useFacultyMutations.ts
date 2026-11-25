import { useMemo } from "react";
import {
  useFacultyContractCreate,
  useFacultyContractUpdate,
  useFacultyContractDelete,
  useFacultyContractBulkDelete,
  useFacultyContractRestore,
  useFacultyContractBulkRestore,
  useFacultyContractBulkStatus,
  useFacultyContractBulkSpecialization,
  useFacultyContractLogSetupAudit,
} from "./useFacultyTsrMutations";

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
  const logSetupAuditMutation = useFacultyContractLogSetupAudit();

  // Stable wrapper: consumers key `useCallback` deps on this object.
  const logSetupAudit = useMemo(
    () => ({
      mutateAsync: (payload: { area: "fields" | "preferences"; summary: string }) =>
        logSetupAuditMutation.mutateAsync({ body: payload }),
      isPending: logSetupAuditMutation.isPending,
    }),
    [logSetupAuditMutation],
  );

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
    logSetupAudit,
  };
}
