import { useTranslation } from "@/hooks/useTranslation";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { resolveDashboardRole } from "@/lib/dashboardRole";
import {
  useDashboardData,
  useDashboardPreferencesQuery,
} from "@/tenant/hooks/collections/dashboard";
import {
  buildDashboardNotifications,
  type DashboardNotificationItem,
} from "@/lib/buildDashboardNotifications";
import { useNotificationReadState } from "@/tenant/hooks/notifications/useNotificationReadState";
import { useStoredNotifications } from "@/tenant/hooks/notifications/useStoredNotifications";

export interface TenantNotification extends DashboardNotificationItem {
  read: boolean;
  /** Set on server-stored notifications, whose read state lives on the server. */
  storedId?: string;
}

/**
 * Tenant shell notifications (popover + `/notifications` page): server-stored events first, then
 * alerts derived from dashboard metrics. Read state goes to the server for stored items and to
 * the per-user UI-state store for derived ones.
 */
export function useTenantNotifications() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const { formatCurrency } = useFinanceCurrency();
  const { data: preferences } = useDashboardPreferencesQuery();
  const dashboardRole = resolveDashboardRole(can);
  const { financeMetrics, attendanceMetrics, studentMetricsInactive } = useDashboardData(
    [],
    dashboardRole,
  );
  const { isRead, markRead, markAllRead } = useNotificationReadState();
  const stored = useStoredNotifications();

  const items = buildDashboardNotifications(
    dashboardRole,
    {
      outstandingInvoiceCount: financeMetrics?.outstanding ?? 0,
      outstandingBalance: financeMetrics?.outstandingBalance ?? 0,
      attendanceRate:
        attendanceMetrics?.selectedDatePresentRate ?? attendanceMetrics?.overallPresentRate ?? null,
      inactiveStudents: studentMetricsInactive,
    },
    t,
    formatCurrency,
    can,
    {
      lowAttendanceThreshold: preferences.lowAttendanceThreshold,
      urgentAttendanceThreshold: preferences.urgentAttendanceThreshold,
    },
  );

  const notifications: TenantNotification[] = [
    ...stored.items,
    ...items.map((item) => ({ ...item, read: isRead(item) })),
  ];
  const unreadCount = notifications.filter((item) => !item.read).length;

  return {
    notifications,
    unreadCount,
    markRead: (notification: TenantNotification) => {
      if (notification.storedId) stored.markRead(notification.storedId);
      else markRead(notification);
    },
    markAllRead: () => {
      markAllRead(items);
      stored.markAllRead();
    },
  };
}
