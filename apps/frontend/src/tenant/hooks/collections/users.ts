/**
 * Cross-module public surface for Users Query hooks.
 * Other features and shared UI must import from here — not `@/tenant/features/users/hooks/*`.
 */
export {
  USERS_LIST_QUERY_KEY,
  USERS_METRICS_QUERY_KEY,
  ACTIVITY_LOGS_QUERY_KEY,
  extractActivityLogs,
  useUsersByIds,
  useUsersMetrics,
  usersCommandMetricsQueryOptions,
  useActivityLogs,
  useUsersMutations,
} from "@/tenant/features/users/hooks/useUsersApi";
export {
  type UsersListPageResult,
  type UsersPaginatedParams,
} from "@/tenant/features/users/hooks/usersQueryKeys";
export {
  useUsersPaginated,
  fetchAllUsersForQuery,
} from "@/tenant/features/users/hooks/useUsersListQueries";
export {
  setUserFieldConfigMemory,
  setUserPreferencesMemory,
} from "@/tenant/features/users/hooks/userSetupConfigApi";
export {
  useComposedUsersSettings,
  useUserPreferencesMutation,
  useUserPreferencesQuery,
  USERS_PREFERENCES_QUERY_KEY,
} from "@/tenant/features/users/hooks/useUserSetupConfig";
export { invalidateUsersQueries } from "@/tenant/features/users/hooks/invalidateUsersQueries";
// Phase 7: contract-driven tsrClient hooks & query factories
export {
  usersListQueryOptions,
  useUsersContractList,
  useUsersContractCreate,
  useUsersContractUpdate,
  useUsersContractInvite,
  useUsersContractBulkUpdate,
  useUsersContractBulkDelete,
  useUsersContractBulkRestore,
  useUsersContractDelete,
  useUsersContractRestore,
  useUsersContractVerifyEmail,
} from "@/tenant/features/users/hooks/useUsersTsrHooks";

/** Role catalog create — Faculty and other modules must import from this facade. */
export { RoleFormModal } from "@/tenant/features/users/components/RoleFormModal";
export {
  useCreateWorkspaceRole,
  type UseCreateWorkspaceRoleResult,
} from "@/tenant/features/users/hooks/useCreateWorkspaceRole";
