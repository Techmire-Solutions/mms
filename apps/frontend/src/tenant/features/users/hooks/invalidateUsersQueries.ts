import { createModuleQueryInvalidator } from "@/lib/query/createModuleQueryInvalidator";
import {
  ACTIVITY_LOGS_QUERY_KEY,
  USERS_LIST_QUERY_KEY,
  USERS_METRICS_QUERY_KEY,
} from "@/tenant/features/users/hooks/usersQueryKeys";
import { USERS_PREFERENCES_QUERY_KEY } from "@/tenant/features/users/hooks/useUserSetupConfig";

/** Invalidate Users list/metrics/activity-logs/setup Query keys (mutations + live push). */
export const invalidateUsersQueries = createModuleQueryInvalidator({
  list: USERS_LIST_QUERY_KEY,
  lists: [ACTIVITY_LOGS_QUERY_KEY],
  metrics: USERS_METRICS_QUERY_KEY,
  preferences: USERS_PREFERENCES_QUERY_KEY,
});
