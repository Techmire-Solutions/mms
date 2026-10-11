import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { DashboardNotificationItem } from "@/lib/buildDashboardNotifications";
import { DASHBOARD_NOTIFICATION_ICONS as ICONS } from "@/lib/dashboardNotificationIcons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/badge";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { WidgetCardHeader } from "@/components/ui/WidgetCardHeader";

interface NotificationsPanelProps {
  items: DashboardNotificationItem[];
  /** Opens the notification's source (invoices, students, attendance day). */
  onOpen?: (item: DashboardNotificationItem) => void;
}

const SESSION_STORAGE_KEY = "mms_dashboard_dismissed_notifs";

function getInitialDismissed(): Array<string | number> {
  try {
    const raw =
      typeof window !== "undefined" ? window.sessionStorage?.getItem(SESSION_STORAGE_KEY) : null;
    return raw ? (JSON.parse(raw) as Array<string | number>) : [];
  } catch {
    return [];
  }
}

function saveDismissedToSession(ids: Array<string | number>): void {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      if (ids.length === 0) {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(ids));
      }
    }
  } catch {
    // Gracefully ignore storage quota / sandbox restrictions
  }
}

export function NotificationsPanel({ items, onOpen }: NotificationsPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<Array<string | number>>(getInitialDismissed);

  const dismissedSet = (() => new Set(dismissed))();

  const { visible, urgent } = (() => {
    let urgentCount = 0;
    const filtered = items.filter((item) => {
      if (dismissedSet.has(item.id)) return false;
      if (item.urgent) urgentCount += 1;
      return true;
    });
    return { visible: filtered, urgent: urgentCount };
  })();

  const handleDismiss = (id: string | number) => {
    setDismissed((prev) => {
      const next = [...prev, id];
      saveDismissedToSession(next);
      return next;
    });
  };

  const handleRestoreAll = () => {
    setDismissed([]);
    saveDismissedToSession([]);
  };

  return (
    <WidgetCard ariaLabelledby="notifications-heading" accentColor="warning">
      <WidgetCardHeader
        headingId="notifications-heading"
        icon={
          <Bell
            className={`w-4 h-4 text-warning/70 group-hover:text-warning transition-colors shrink-0 ${urgent > 0 ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
        }
        title={t("notifications.title")}
        badge={
          urgent > 0 && (
            <Badge
              variant="destructive"
              className="text-xs shrink-0 font-bold uppercase tracking-wider"
              aria-label={t("notifications.urgentCount", { count: urgent })}
            >
              {urgent} {t("notifications.urgent")}
            </Badge>
          )
        }
        actions={
          dismissed.length > 0 && (
            <Button
              variant="link"
              onClick={handleRestoreAll}
              className="text-xs font-bold shrink-0 min-h-11 px-2 text-primary hover:text-primary/80 transition-colors"
            >
              {t("notifications.restoreAll")}
            </Button>
          )
        }
      />

      <div
        className="divide-y divide-border/40 max-h-notifications overflow-y-auto"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {visible.length === 0 ? (
            <EmptyState
              title={t("notifications.empty")}
              description={t("notifications.emptyHint")}
              icon={Bell}
              compact
              className="select-none px-5"
            />
          ) : (
            visible.map((notif) => {
              const meta = ICONS[notif.type] || ICONS.fee;
              const Icon = meta.icon;
              return (
                <motion.article
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`flex items-start gap-1 pe-3 hover:bg-muted/30 transition-colors ${
                    notif.urgent ? "bg-destructive/[0.03]" : ""
                  }`}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!onOpen || !notif.target}
                    onClick={() => onOpen?.(notif)}
                    className="flex flex-1 min-w-0 h-auto min-h-11 items-start justify-start gap-3 whitespace-normal rounded-none ps-5 pe-2 py-3.5 text-start hover:bg-transparent disabled:opacity-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span
                      className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}
                      aria-hidden="true"
                    >
                      <Icon className={`w-4 h-4 ${meta.text}`} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-start gap-2">
                        <span className="block text-sm font-bold text-foreground leading-snug flex-1">
                          {notif.title}
                        </span>
                        {notif.urgent && (
                          <Badge
                            pill
                            variant="destructive"
                            className="uppercase tracking-wider flex-shrink-0 select-none"
                          >
                            {t("notifications.urgentLabel")}
                          </Badge>
                        )}
                      </span>
                      <span className="block text-sm text-muted-foreground mt-0.5 leading-normal">
                        {notif.desc}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-1 font-medium">
                        {notif.time}
                      </span>
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDismiss(notif.id)}
                    className="text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0 mt-2 shadow-none"
                    aria-label={t("notifications.dismiss", { title: notif.title })}
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                </motion.article>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </WidgetCard>
  );
}

export default NotificationsPanel;
