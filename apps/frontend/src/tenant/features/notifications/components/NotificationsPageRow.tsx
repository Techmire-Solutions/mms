import React from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { DASHBOARD_NOTIFICATION_ICONS } from "@/lib/ui/dashboardNotificationIcons";
import type { TenantNotification } from "@/tenant/hooks/notifications/useTenantNotifications";

interface NotificationsPageRowProps {
  notification: TenantNotification;
  onOpen: () => void;
}

export function NotificationsPageRow({
  notification,
  onOpen,
}: NotificationsPageRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const meta = DASHBOARD_NOTIFICATION_ICONS[notification.type];
  const Icon = meta.icon;

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onOpen}
      disabled={!notification.target}
      className={cn(
        "flex h-auto min-h-11 w-full items-start justify-start gap-3 whitespace-normal rounded-none px-5 py-4 text-start transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring cursor-pointer disabled:cursor-not-allowed",
        !notification.read && "bg-primary/5",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          meta.bg,
        )}
        aria-hidden="true"
      >
        <Icon className={cn("h-4 w-4", meta.text)} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-sm text-foreground text-balance",
              notification.read ? "font-medium" : "font-bold",
            )}
          >
            {notification.title}
          </span>
          {notification.urgent && (
            <Badge pill variant="destructive" className="uppercase tracking-wider">
              {t("notifications.urgentLabel")}
            </Badge>
          )}
          {!notification.read && (
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
          )}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground text-pretty">
          {notification.desc}
        </span>
        <span className="mt-1 block text-xs font-medium text-muted-foreground">
          {notification.time}
        </span>
      </span>
      {notification.target && (
        <ChevronRight
          className="mt-2 h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180"
          aria-hidden="true"
        />
      )}
    </Button>
  );
}
