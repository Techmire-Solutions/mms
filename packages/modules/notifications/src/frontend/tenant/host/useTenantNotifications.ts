import { getNotificationsHost } from "../host.js";
import type { TenantNotification } from "../lib/notificationsTypes.js";

export function useTenantNotifications(): {
  notifications: TenantNotification[];
  unreadCount: number;
  markRead: (notification: TenantNotification) => void;
  markAllRead: () => void;
} {
  return getNotificationsHost().useTenantNotifications();
}
