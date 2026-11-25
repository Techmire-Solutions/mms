import type { NotificationsRepository } from "./notificationsRepository.js";
import {
  insertTenantNotification,
  listTenantNotifications,
  markAllTenantNotificationsRead,
  markTenantNotificationRead,
} from "./tenantNotificationsRepository.js";

/** Drizzle-backed {@link NotificationsRepository}. */
export const notificationsRepository: NotificationsRepository = {
  insertTenantNotification,
  listTenantNotifications,
  markTenantNotificationRead,
  markAllTenantNotificationsRead,
};
