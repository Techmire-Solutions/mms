import { useTranslation } from "@/hooks/useTranslation";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { resolveDashboardRole } from "@/lib/dashboardRole";
import { useDashboardData } from "@/tenant/features/dashboard/hooks/useDashboardData";
import { useDashboardPreferencesQuery } from "@/tenant/hooks/collections/dashboard";
import {
  buildDashboardNotifications,
  type DashboardNotificationItem,
} from "@/lib/buildDashboardNotifications";
import { useNotificationReadState } from "@/tenant/hooks/notifications/useNotificationReadState";

export interface TenantNotification extends DashboardNotificationItem {
  read: boolean;
}

/** Tenant shell notifications (popover + `/notifications` page) with per-user read state. */
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

  const notifications: TenantNotification[] = items.map((item) => ({
    ...item,
    read: isRead(item),
  }));
  const unreadCount = notifications.filter((item) => !item.read).length;

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead: () => markAllRead(items),
  };
}
