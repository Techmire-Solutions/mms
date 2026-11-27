import type { ComponentType } from "react";
import type {
  DashboardNotificationIconMeta,
  TenantNotification,
} from "./lib/notificationsTypes.js";

export interface NotificationsHostValue {
  useTenantNotifications: () => {
    notifications: TenantNotification[];
    unreadCount: number;
    markRead: (notification: TenantNotification) => void;
    markAllRead: () => void;
  };
  useOpenTenantNotification: () => (target: unknown) => void;
  DASHBOARD_NOTIFICATION_ICONS: Record<string, DashboardNotificationIconMeta>;
}

let configured: NotificationsHostValue | null = null;

/** Composition-root binding; called by the app provider bridge. */
export function configureNotificationsHost(next: NotificationsHostValue): void {
  configured = next;
}

/** App-bound notifications host. Module UI never imports `@/…`. */
export function getNotificationsHost(): NotificationsHostValue {
  if (configured) return configured;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("Notifications host is not configured (call configureNotificationsHost)");
}

const noop = () => undefined;
const BellIcon: ComponentType<{ className?: string }> = () => null;
const TEST_HOST: NotificationsHostValue = {
  useTenantNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markRead: noop,
    markAllRead: noop,
  }),
  useOpenTenantNotification: () => noop,
  DASHBOARD_NOTIFICATION_ICONS: new Proxy(
    {},
    { get: () => ({ icon: BellIcon, bg: "", text: "" }) },
  ) as Record<string, DashboardNotificationIconMeta>,
};
