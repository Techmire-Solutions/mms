/**
 * @file useFacultyTsrHooks.ts
 * @description Barrel re-exports for Faculty contract query + mutation hooks.
 */
export {
  facultyListQueryOptions,
  useFacultyContractList,
  useFacultyContractGet,
  useFacultyContractNextEmployeeId,
} from "./useFacultyTsrQueries";

export {
  useFacultyContractCreate,
  useFacultyContractUpdate,
  useFacultyContractDelete,
  useFacultyContractBulkStatus,
  useFacultyContractDuplicateCheck,
  useFacultyContractRestore,
  useFacultyContractBulkDelete,
  useFacultyContractBulkRestore,
  useFacultyContractBulkSpecialization,
  useFacultyContractMigrateEmployeeIds,
  useFacultyContractLogExportAudit,
  useFacultyContractLogSetupAudit,
} from "./useFacultyTsrMutations";
