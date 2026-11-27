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
} from "@mms/mod-iam/frontend/tenant/hooks/useUsersApi";
export {
  type UsersListPageResult,
  type UsersPaginatedParams,
} from "@mms/mod-iam/frontend/tenant/hooks/usersQueryKeys";
export {
  useUsersPaginated,
  fetchAllUsersForQuery,
} from "@mms/mod-iam/frontend/tenant/hooks/useUsersListQueries";
export {
  setUserFieldConfigMemory,
  setUserPreferencesMemory,
} from "@mms/mod-iam/frontend/tenant/hooks/userSetupConfigApi";
export {
  useComposedUsersSettings,
  useUserPreferencesMutation,
  useUserPreferencesQuery,
  USERS_PREFERENCES_QUERY_KEY,
} from "@mms/mod-iam/frontend/tenant/hooks/useUserSetupConfig";
export { invalidateUsersQueries } from "@mms/mod-iam/frontend/tenant/hooks/invalidateUsersQueries";
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
} from "@mms/mod-iam/frontend/tenant/hooks/useUsersQueries";

/** Role catalog create — Faculty and other modules must import from this facade. */
export { RoleFormModal } from "@mms/mod-iam/frontend/tenant/components/RoleFormModal";
export {
  useCreateWorkspaceRole,
  type UseCreateWorkspaceRoleResult,
} from "@mms/mod-iam/frontend/tenant/hooks/useCreateWorkspaceRole";
