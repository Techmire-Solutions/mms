import type { TenantNotificationList } from "@mms/shared";
import type { NewTenantNotification } from "../../db/repositories/tenantNotificationsRepository.js";

export type { NewTenantNotification };

/** Storage port for stored in-app notifications; the Drizzle adapter is the only implementation. */
export interface NotificationsRepository {
  /** Returns false when the row already existed for its `dedupeKey`. */
  insertTenantNotification(tenant: string, notification: NewTenantNotification): Promise<boolean>;
  listTenantNotifications(
    tenant: string,
    userId: string,
    permissions: string[],
  ): Promise<TenantNotificationList>;
  markTenantNotificationRead(
    tenant: string,
    id: string,
    userId: string,
    permissions: string[],
  ): Promise<boolean>;
  markAllTenantNotificationsRead(
    tenant: string,
    userId: string,
    permissions: string[],
  ): Promise<void>;
}
