import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/config/routes";
import type { DashboardNotificationTarget } from "@/lib/buildDashboardNotifications";
import { applyFinanceWorkDrillDown } from "@/tenant/hooks/collections/finance";
import { applyStudentsWorkDrillDown } from "@/tenant/hooks/collections/students";
import { applyAttendanceWorkDrillDown } from "@/tenant/hooks/collections/attendance";
import { applyEnrollmentsWorkDrillDown } from "@/tenant/hooks/collections/enrollments";

/** Presets the target module's Work filters, then routes to it. */
export function openNotificationTarget(
  target: DashboardNotificationTarget,
  navigate: (path: string) => void,
): void {
  switch (target.kind) {
    case "invoices":
      applyFinanceWorkDrillDown({ invoiceStatuses: target.statuses });
      navigate(ROUTES.finance);
      return;
    case "students":
      applyStudentsWorkDrillDown({ status: target.status });
      navigate(ROUTES.students);
      return;
    case "attendanceDay":
      applyAttendanceWorkDrillDown({ date: target.date });
      navigate(ROUTES.attendance);
      return;
    case "admissions":
      applyEnrollmentsWorkDrillDown({ subTab: "admissions" });
      navigate(ROUTES.enrollments);
      return;
  }
}

/** Returns a handler that opens a notification's target (no-op when it has none). */
export function useOpenTenantNotification() {
  const navigate = useNavigate();
  return (target: DashboardNotificationTarget | undefined) => {
    if (target) openNotificationTarget(target, navigate);
  };
}
