import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { tenantNotificationListSchema, type TenantNotificationList } from "@mms/contracts";
import { apiJson } from "@mms/fe-core/api/client";

/** Server-stored notifications (e.g. a freed waitlist seat), filtered by the caller's permissions.
 * Auth-prefixed so the persisted Query cache never restores another account's list. */
export const STORED_NOTIFICATIONS_QUERY_KEY = ["auth", "notifications", "stored"] as const;

export function storedNotificationsQueryOptions() {
  return queryOptions({
    queryKey: STORED_NOTIFICATIONS_QUERY_KEY,
    queryFn: async ({ signal }): Promise<TenantNotificationList> =>
      tenantNotificationListSchema.parse(await apiJson<unknown>("/api/notifications", { signal })),
    staleTime: 60_000,
  });
}

export async function markStoredNotificationRead(id: string): Promise<void> {
  await apiJson<unknown>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
}

export async function markAllStoredNotificationsRead(): Promise<void> {
  await apiJson<unknown>("/api/notifications/read-all", { method: "POST" });
}

export function invalidateStoredNotificationsQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: STORED_NOTIFICATIONS_QUERY_KEY });
}
