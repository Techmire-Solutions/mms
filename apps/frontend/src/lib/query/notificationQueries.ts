import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { tenantNotificationListSchema, type TenantNotificationList } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

/** Server-stored notifications (e.g. a freed waitlist seat), filtered by the caller's permissions. */
export const STORED_NOTIFICATIONS_QUERY_KEY = ["notifications", "stored"] as const;

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
