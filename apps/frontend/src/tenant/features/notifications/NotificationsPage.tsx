import React from "react";
import { Bell, CheckCheck } from "lucide-react";
import { ModulePageShell } from "@/components/ui/ModulePageShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/badge";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { useTenantNotifications } from "@/tenant/hooks/notifications/useTenantNotifications";
import { useOpenTenantNotification } from "@/tenant/hooks/notifications/useOpenTenantNotification";
import { NotificationsPageRow } from "@/tenant/features/notifications/NotificationsPageRow";

/** All tenant notifications with click-through to the source record and a mark-all-read action. */
export default function NotificationsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const openNotification = useOpenTenantNotification();
  const { notifications, unreadCount, markRead, markAllRead } = useTenantNotifications();

  return (
    <ModulePageShell
      seoTitle={`MMS - ${t("notifications.title")}`}
      seoDescription={t("notifications.pageSubtitle")}
      headerIcon={Bell}
      headerTitle={t("notifications.title")}
      headerSubtitle={t("notifications.pageSubtitle")}
      headerActions={
        notifications.length > 0 ? (
          <Button
            variant="outline"
            icon={CheckCheck}
            disabled={unreadCount === 0}
            onClick={markAllRead}
          >
            {t("notifications.markAllRead")}
          </Button>
        ) : undefined
      }
    >
      <section aria-labelledby="notifications-list-heading" className={WORK_SURFACE}>
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2
            id="notifications-list-heading"
            className="text-sm font-bold text-foreground text-balance"
          >
            {t("notifications.title")}
          </h2>
          <Badge
            tone={unreadCount > 0 ? "primary" : "muted"}
            size="sm"
            role="status"
            aria-live="polite"
          >
            {unreadCount > 0
              ? t("notifications.unreadCount", { count: unreadCount })
              : t("notifications.allRead")}
          </Badge>
        </header>
        {notifications.length === 0 ? (
          <EmptyState
            title={t("notifications.empty")}
            description={t("notifications.emptyHint")}
            icon={Bell}
            className="py-10"
          />
        ) : (
          <ul className="divide-y divide-border/50">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <NotificationsPageRow
                  notification={notification}
                  onOpen={() => {
                    markRead(notification);
                    openNotification(notification.target);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </ModulePageShell>
  );
}
