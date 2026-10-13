import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { NotificationsPopover, type NotificationItem } from "@/components/app/NotificationsPopover";
import { ROUTES } from "@/lib/config/routes";
import { useTenantNotifications } from "@/tenant/hooks/notifications/useTenantNotifications";
import { useOpenTenantNotification } from "@/tenant/hooks/notifications/useOpenTenantNotification";

/**
 * Tenant notifications popover delegating presentation to universal NotificationsPopover primitive.
 */
export function TenantNotificationsPopover(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openNotification = useOpenTenantNotification();
  const { notifications, unreadCount, markRead } = useTenantNotifications();

  const notificationItems: NotificationItem[] = notifications.map((n) => ({
    id: n.id,
    title: n.title,
    desc: n.desc,
    time: n.time,
    urgent: n.urgent,
    read: n.read,
    onClick: () => {
      markRead(n);
      openNotification(n.target);
    },
  }));

  return (
    <NotificationsPopover
      notifications={notificationItems}
      unreadCount={unreadCount}
      title={t("notifications.title")}
      emptyText={t("notifications.empty")}
      ariaLabel={t("notifications.title")}
      viewAllLabel={t("notifications.viewAll")}
      onViewAll={() => navigate(ROUTES.notifications)}
    />
  );
}
