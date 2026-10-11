import type React from "react";
import { AlertTriangle, Calendar, User, DollarSign } from "lucide-react";
import type { DashboardNotificationType } from "@/lib/buildDashboardNotifications";

export interface DashboardNotificationIconMeta {
  icon: React.ElementType;
  bg: string;
  text: string;
}

/** Icon + semantic tint per notification type (dashboard panel and notifications page). */
export const DASHBOARD_NOTIFICATION_ICONS: Record<
  DashboardNotificationType,
  DashboardNotificationIconMeta
> = {
  fee: { icon: DollarSign, bg: "bg-destructive/10", text: "text-destructive" },
  event: { icon: Calendar, bg: "bg-info/10", text: "text-info" },
  student: { icon: User, bg: "bg-success/10", text: "text-success" },
  attendance: { icon: AlertTriangle, bg: "bg-warning/10", text: "text-warning" },
};
