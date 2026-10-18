import React from "react";
import { useNavigate } from "react-router-dom";
import type { PlatformWorkspaceRow } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { buildPlatformNotifications } from "@/platform/lib/buildPlatformNotifications";
import { usePlatformNotificationAck } from "@/platform/hooks/usePlatformNotificationAck";
import { NotificationsPopover, type NotificationItem } from "@shared/ui";
import { ROUTES } from "@/lib/config/routes";

export interface PlatformNotificationsPopoverProps {
  workspaces: PlatformWorkspaceRow[] | undefined;
  isSuperUser: boolean;
}

/**
 * Platform notifications popover delegating to universal NotificationsPopover primitive.
 */
export function PlatformNotificationsPopover({
  workspaces,
  isSuperUser,
}: PlatformNotificationsPopoverProps): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ackedIds, ackAll } = usePlatformNotificationAck();

  const notifications = buildPlatformNotifications(workspaces, isSuperUser, t);
  const unreadCount = notifications.filter((n) => !ackedIds.has(n.id)).length;

  const handleSelect = (item: NotificationItem) => {
    if (item.href) {
      navigate(item.href);
    } else {
      navigate(ROUTES.platformReports);
    }
  };

  return (
    <NotificationsPopover
      notifications={notifications}
      unreadCount={unreadCount}
      title={t("platform.notificationsTitle")}
      emptyText={t("platform.notificationsAllCaughtUp")}
      ariaLabel={t("platform.notificationsAria")}
      newBadgeLabel={t("platform.notificationsNewBadge", { count: String(unreadCount) })}
      viewAllLabel={t("platform.notificationsViewAllReports")}
      onViewAll={() => navigate(ROUTES.platformReports)}
      onSelectNotification={handleSelect}
      onOpenChange={(open) => {
        if (!open) ackAll(notifications.map((n) => n.id));
      }}
    />
  );
}
