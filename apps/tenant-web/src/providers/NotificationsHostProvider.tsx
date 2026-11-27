import React from "react";
import {
  configureNotificationsHost,
  type NotificationsHostValue,
} from "@mms/mod-notifications/frontend/tenant/host";
import { useTenantNotifications } from "@/tenant/hooks/notifications/useTenantNotifications";
import { useOpenTenantNotification } from "@/tenant/hooks/notifications/useOpenTenantNotification";
import { DASHBOARD_NOTIFICATION_ICONS } from "@/lib/ui/dashboardNotificationIcons";

/** Binds the app notification queries and icon map into the notifications module host. */
export function NotificationsHostBridge({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  configureNotificationsHost({
    useTenantNotifications:
      useTenantNotifications as unknown as NotificationsHostValue["useTenantNotifications"],
    useOpenTenantNotification:
      useOpenTenantNotification as unknown as NotificationsHostValue["useOpenTenantNotification"],
    DASHBOARD_NOTIFICATION_ICONS: DASHBOARD_NOTIFICATION_ICONS as unknown as Record<
      string,
      { icon: React.ComponentType<{ className?: string }>; bg: string; text: string }
    >,
  });
  return <>{children}</>;
}
