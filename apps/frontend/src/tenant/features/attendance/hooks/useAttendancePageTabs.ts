import { useTranslation } from "@/hooks/useTranslation";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useFilteredModuleTierTabs } from "@/tenant/hooks/useModuleTierTabs";
import { resolveModuleTierTab, ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { ClipboardEdit, BookOpen, ClipboardList, BarChart2, CalendarX } from "lucide-react";

export function useAttendancePageTabs(
  activeTab: string,
  activeOpsTab: string,
  activeAnalyticsTab: string,
  canViewSetup: boolean,
) {
  const { t } = useTranslation();
  const {
    canWrite: canWriteAttendance,
    canDelete: canDeleteAttendance,
    canRead: canAnalyticsView,
  } = useModulePermissions(ATTENDANCE_MODULE_MANIFEST);
  const { can } = usePermissions();

  const canSeeAttendanceAnalytics =
    canAnalyticsView &&
    (can("users.manage") ||
      canWriteAttendance ||
      can("enrollments.write") ||
      !can("finance.write"));

  const visibleTopTabs = useFilteredModuleTierTabs({
    canViewSetup,
    canViewReports: canSeeAttendanceAnalytics,
    workLabelKey: "nav.attendance",
  });

  const visibleOperationsTabs = (() =>
    [
      {
        id: "mark",
        label: t("attendance.tabs.mark"),
        icon: ClipboardEdit,
        visible: canWriteAttendance,
      },
      {
        id: "records",
        label: t("attendance.tabs.records"),
        icon: BookOpen,
        visible: canAnalyticsView,
      },
      {
        id: "audit",
        label: t("attendance.tabs.audit"),
        icon: ClipboardList,
        visible: canDeleteAttendance,
      },
    ].filter((tab) => tab.visible))();

  const visibleAnalyticsTabs = (() =>
    [
      {
        id: "charts",
        label: t("attendance.tabs.analyticsCharts"),
        icon: BarChart2,
        visible: canSeeAttendanceAnalytics,
      },
      {
        id: "coverage",
        label: t("attendance.tabs.coverage"),
        icon: CalendarX,
        visible: canSeeAttendanceAnalytics,
      },
      {
        id: "reports",
        label: t("attendance.tabs.reports"),
        icon: ClipboardList,
        visible: canSeeAttendanceAnalytics,
      },
    ].filter((tab) => tab.visible))();

  const effectiveTab = resolveModuleTierTab(
    activeTab,
    visibleTopTabs.map((tab) => tab.id),
  );
  const effectiveOpsTab = visibleOperationsTabs.find((tab) => tab.id === activeOpsTab)
    ? activeOpsTab
    : visibleOperationsTabs[0]?.id || "records";
  const effectiveAnalyticsTab = visibleAnalyticsTabs.find((tab) => tab.id === activeAnalyticsTab)
    ? activeAnalyticsTab
    : visibleAnalyticsTabs[0]?.id || "reports";

  return {
    canWriteAttendance,
    canDeleteAttendance,
    canAnalyticsView,
    canSeeAttendanceAnalytics,
    visibleTopTabs,
    visibleOperationsTabs,
    visibleAnalyticsTabs,
    effectiveTab,
    effectiveOpsTab,
    effectiveAnalyticsTab,
  };
}
