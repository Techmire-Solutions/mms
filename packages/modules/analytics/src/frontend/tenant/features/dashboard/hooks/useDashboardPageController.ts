import { useState, useCallback, useMemo, useRef } from "react";
import { DASHBOARD_MODULE_MANIFEST, SESSIONS_MODULE_MANIFEST } from "@mms/contracts";
import { resolveDashboardRole } from "../../../lib/dashboardRole";
import {
  getActiveCustomCardIds,
  isDashboardWidgetAllowed,
} from "../../../lib/dashboardCollections";
import { usePermissions } from "../../../host/usePermissions";
import type { CustomWidget } from "@mms/mod-analytics/frontend/tenant/lib/pinnedWidgetTypes";
import { useDashboardData } from "./useDashboardData";
import { useDashboardMetricCards } from "./useDashboardMetricCards";
import { useModuleAccess, useSessionsReportAggregates } from "../../../host/collections";
import { useTranslation } from "@mms/fe-core/i18n";
import { useDashboardConfig } from "../../../host/useDashboardConfig";
import { buildDashboardNotifications } from "../../../lib/buildDashboardNotifications";
import { useFinanceCurrency } from "../../../host/useCurrency";

export function useDashboardPageController() {
  const { t } = useTranslation();
  const { formatCurrency } = useFinanceCurrency();
  const { can } = usePermissions();
  const dashboardRole = resolveDashboardRole(can);
  // Server-authoritative grant ∧ enablement; all false while loading, so no module widget fetches early.
  const { effectiveModules: enabledModules } = useModuleAccess();

  const {
    disabledCardIds,
    customWidgets,
    lowAttendanceThreshold,
    urgentAttendanceThreshold,
    toggleCardVisibility,
    toggleWidgetPin,
    unpinWidget,
    deleteWidget,
    saveWidget,
    updatePref,
    reorderCustomWidgets,
    isConfigReady,
  } = useDashboardConfig();

  const [isEditMode, setIsEditMode] = useState(false);
  const [isWidgetBuilderOpen, setIsWidgetBuilderOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<CustomWidget | null>(null);
  const [widgetBuilderType, setWidgetBuilderType] = useState<CustomWidget["widgetType"]>("card");
  const builderOpenerRef = useRef<Element | null>(null);

  const canCustomize = can(DASHBOARD_MODULE_MANIFEST.permissions.customize);

  const dashboardData = useDashboardData(customWidgets, dashboardRole, enabledModules, can);
  const {
    financeMetrics,
    attendanceMetrics,
    sessionsMetrics,
    studentMetricsInactive,
    studentMetricsActive,
  } = dashboardData;

  const closeBuilder = useCallback(() => {
    setIsWidgetBuilderOpen(false);
    setEditingWidget(null);
    // Return focus to the element that opened the builder (keyboard a11y).
    const opener = builderOpenerRef.current;
    builderOpenerRef.current = null;
    if (opener instanceof HTMLElement && opener.isConnected) {
      opener.focus();
    }
  }, []);

  const openWidgetBuilder = useCallback(
    (type: CustomWidget["widgetType"], widget: CustomWidget | null = null) => {
      if (!canCustomize) return;
      if (!isEditMode) setIsEditMode(true);
      builderOpenerRef.current = document.activeElement;
      setEditingWidget(widget);
      setWidgetBuilderType(type);
      setIsWidgetBuilderOpen(true);
    },
    [canCustomize, isEditMode],
  );

  const handleEditWidget = useCallback(
    (widget: CustomWidget) => {
      openWidgetBuilder(widget.widgetType || "kpi", widget);
    },
    [openWidgetBuilder],
  );

  const handleSaveWidget = async (savedWidget: CustomWidget) => {
    try {
      await saveWidget(savedWidget);
      closeBuilder();
    } catch {
      // onError already toasted; keep builder open for retry.
    }
  };

  const handleReorderWidgets = (reorderedWidgets: CustomWidget[]) => {
    const order = reorderedWidgets.map((w, idx) => ({ id: w.id, sortOrder: idx }));
    reorderCustomWidgets(order);
  };

  const handleUpdateThreshold = (
    key: "lowAttendanceThreshold" | "urgentAttendanceThreshold",
    value: number,
  ) => {
    updatePref(key, value);
  };

  const activeCustomCardIds = useMemo(
    () => getActiveCustomCardIds(customWidgets, dashboardRole),
    [customWidgets, dashboardRole],
  );

  const dashboardMetricCards = useDashboardMetricCards({
    customWidgets,
    dashboardRole,
    enabledModules,
    can,
    data: dashboardData,
    t,
    formatCurrency,
  });

  const handleEditCustomCard = (customCardId: string) => {
    const widget = customWidgets.find(
      (dashboardWidget: any) => dashboardWidget.id === customCardId,
    );
    if (widget) handleEditWidget(widget);
  };

  const visibleDashboardMetricCards = useMemo(() => {
    const disabledSet = new Set(disabledCardIds);
    return dashboardMetricCards.filter((dashboardCard: any) => !disabledSet.has(dashboardCard.id));
  }, [dashboardMetricCards, disabledCardIds]);

  const selectedDashboardCardCount = visibleDashboardMetricCards.length;

  const visiblePinnedWidgets = useMemo(
    () =>
      customWidgets.filter(
        (widget: any) =>
          widget.isPinnedToDashboard &&
          widget.widgetType !== "card" &&
          isDashboardWidgetAllowed(widget, enabledModules, can),
      ),
    [customWidgets, enabledModules, can],
  );

  const pinnedDashboardWidgetCount = visiblePinnedWidgets.length;

  const canReadSessions =
    Boolean(enabledModules?.sessions) && can(SESSIONS_MODULE_MANIFEST.permissions.read);
  const { data: sessionsReport } = useSessionsReportAggregates({ enabled: canReadSessions }) ?? {};

  const todayScheduleWindow = useMemo<string | undefined>(() => {
    const todaysSessions = sessionsReport?.todaysSessions;
    if (!Array.isArray(todaysSessions) || todaysSessions.length === 0) return undefined;
    const uniqueTimes = Array.from(
      new Set(
        todaysSessions
          .map((session: { time?: string }) => (session.time ?? "").trim())
          .filter((value: string) => value.length > 0),
      ),
    );
    return uniqueTimes.length > 0 ? uniqueTimes.slice(0, 2).join(" · ") : "";
  }, [sessionsReport]);

  const notifications = useMemo(() => {
    const todayAttendanceRecordedCount = attendanceMetrics
      ? attendanceMetrics.selectedDatePresent +
        attendanceMetrics.selectedDateAbsent +
        attendanceMetrics.selectedDateLate +
        attendanceMetrics.selectedDateExcused
      : null;

    return buildDashboardNotifications(
      dashboardRole,
      {
        outstandingInvoiceCount: financeMetrics?.outstanding ?? 0,
        outstandingBalance: financeMetrics?.outstandingBalance ?? 0,
        attendanceRate:
          attendanceMetrics?.selectedDatePresentRate ??
          attendanceMetrics?.overallPresentRate ??
          null,
        attendanceRecordedToday:
          todayAttendanceRecordedCount === null ? undefined : todayAttendanceRecordedCount > 0,
        todayScheduleWindow,
        inactiveStudents: studentMetricsInactive,
      },
      t,
      formatCurrency,
      can,
      { lowAttendanceThreshold, urgentAttendanceThreshold },
    );
  }, [
    dashboardRole,
    financeMetrics,
    attendanceMetrics,
    todayScheduleWindow,
    studentMetricsInactive,
    t,
    formatCurrency,
    can,
    lowAttendanceThreshold,
    urgentAttendanceThreshold,
  ]);

  const handleResetCards = () => {
    updatePref("disabledCardIds", []);
  };

  return {
    t,
    can,
    dashboardRole,
    canCustomize,
    isEditMode,
    setIsEditMode,
    customWidgets,
    disabledCardIds,
    lowAttendanceThreshold,
    urgentAttendanceThreshold,
    handleUpdateThreshold,
    handleReorderWidgets,
    toggleCardVisibility,
    handleResetCards,
    isLoading: dashboardData.isLoading,
    isWidgetBuilderOpen,
    editingWidget,
    widgetBuilderType,
    closeBuilder,
    handleSaveWidget,
    handleEditWidget,
    handleEditCustomCard,
    handleDeleteWidget: deleteWidget,
    handleUnpinWidget: unpinWidget,
    toggleWidgetPin,
    openWidgetBuilder,
    activeCustomCardIds,
    dashboardMetricCards,
    selectedDashboardCardCount,
    visibleDashboardMetricCards,
    visiblePinnedWidgets,
    pinnedDashboardWidgetCount,
    notifications,
    activeSessionsCount: sessionsMetrics?.active ?? 0,
    studentMetricsActive,
    hasOverdueObligations: (financeMetrics?.outstanding ?? 0) > 0,
    isConfigReady,
    summaryError: dashboardData.summaryError,
    retrySummary: dashboardData.retrySummary,
  };
}
