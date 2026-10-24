/**
 * @file useFacultyTsrMutations.ts
 * @description Contract-backed Faculty write / bulk / audit mutation hooks.
 */
import { tsrClient } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateFacultyQueries } from "@/tenant/features/faculty/hooks/invalidateFacultyQueries";

const facultyClient = tsrClient.faculty;

/** Contract-backed create. */
export function useFacultyContractCreate() {
  const queryClient = useQueryClient();
  return facultyClient.create.useMutation({
    onSuccess: () => invalidateFacultyQueries(queryClient),
  });
}

/** Contract-backed update. */
export function useFacultyContractUpdate() {
  const queryClient = useQueryClient();
  return facultyClient.update.useMutation({
    onSuccess: () => invalidateFacultyQueries(queryClient),
  });
}

/** Contract-backed soft-delete. */
export function useFacultyContractDelete() {
  const queryClient = useQueryClient();
  return facultyClient.delete.useMutation({
    onSuccess: () => invalidateFacultyQueries(queryClient),
  });
}

/** Contract-backed bulk status update. */
export function useFacultyContractBulkStatus() {
  const queryClient = useQueryClient();
  return facultyClient.bulkStatus.useMutation({
    onSuccess: () => invalidateFacultyQueries(queryClient),
  });
}

/** Contract-backed duplicate check mutation. */
export function useFacultyContractDuplicateCheck() {
  return facultyClient.duplicateCheck.useMutation({});
}

/** Contract-backed restore */
export function useFacultyContractRestore() {
  const queryClient = useQueryClient();
  return facultyClient.restore.useMutation({
    onSuccess: () => invalidateFacultyQueries(queryClient),
  });
}

/** Contract-backed bulk delete */
export function useFacultyContractBulkDelete() {
  const queryClient = useQueryClient();
  return facultyClient.bulkDelete.useMutation({
    onSuccess: () => invalidateFacultyQueries(queryClient),
  });
}

/** Contract-backed bulk restore */
export function useFacultyContractBulkRestore() {
  const queryClient = useQueryClient();
  return facultyClient.bulkRestore.useMutation({
    onSuccess: () => invalidateFacultyQueries(queryClient),
  });
}

/** Contract-backed bulk specialization */
export function useFacultyContractBulkSpecialization() {
  const queryClient = useQueryClient();
  return facultyClient.bulkSpecialization.useMutation({
    onSuccess: () => invalidateFacultyQueries(queryClient),
  });
}

/** Contract-backed migrate employee IDs */
export function useFacultyContractMigrateEmployeeIds() {
  return facultyClient.migrateEmployeeIds.useMutation({});
}

/** Contract-backed log export audit */
export function useFacultyContractLogExportAudit() {
  return facultyClient.exportAudit.useMutation({});
}

/** Contract-backed log setup audit */
export function useFacultyContractLogSetupAudit() {
  return facultyClient.setupAudit.useMutation({});
}
