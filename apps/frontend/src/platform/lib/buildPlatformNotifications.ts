import type { PlatformWorkspaceRow } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { ROUTES } from "@/lib/config/routes";

export interface PlatformNotificationItem {
  id: string;
  type: "workspace" | "security" | "system";
  title: string;
  desc: string;
  time: string;
  urgent?: boolean;
  href?: string;
}

/** Builds real-time operational notifications for the Platform Operator Console. */
export function buildPlatformNotifications(
  workspaces: PlatformWorkspaceRow[] | undefined,
  isSuperUser: boolean,
  t: TranslationFunction,
): PlatformNotificationItem[] {
  const notifications: PlatformNotificationItem[] = [];

  if (!workspaces) {
    return notifications;
  }

  const total = workspaces.length;
  const disabledCount = workspaces.filter((w) => w.enabled === false).length;
  const activeCount = workspaces.filter((w) => w.enabled).length;

  if (disabledCount > 0) {
    notifications.push({
      id: "disabled-workspaces",
      type: "workspace",
      title: t("platform.notificationDisabledTitle"),
      desc: t("platform.notificationDisabledDesc", { disabled: disabledCount, total }),
      time: t("platform.notificationTimeNow"),
      urgent: true,
      href: ROUTES.platformWorkspaces,
    });
  }

  if (activeCount > 0) {
    notifications.push({
      id: "active-workspaces-status",
      type: "workspace",
      title: t("platform.notificationActiveTitle"),
      desc: t("platform.notificationActiveDesc", { active: activeCount }),
      time: t("platform.notificationTimeToday"),
      urgent: false,
      href: ROUTES.platformWorkspaces,
    });
  }

  if (isSuperUser) {
    notifications.push({
      id: "super-user-privilege",
      type: "security",
      title: t("platform.notificationSuperUserTitle"),
      desc: t("platform.notificationSuperUserDesc"),
      time: t("platform.notificationTimeActive"),
      urgent: false,
      href: ROUTES.platformUsers,
    });
  }

  notifications.push({
    id: "system-health",
    type: "system",
    title: t("platform.notificationSystemHealthTitle"),
    desc: t("platform.notificationSystemHealthDesc"),
    time: t("platform.notificationTimeToday"),
    urgent: false,
    href: ROUTES.platformSystem,
  });

  return notifications;
}
