import { useState, useCallback } from "react";
import { DASHBOARD_MODULE_MANIFEST } from "@mms/shared";
import { resolveDashboardRole } from "@/lib/dashboardRole";
import { getActiveCustomCardIds, isDashboardWidgetAllowed } from "@/lib/dashboardCollections";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { useDashboardData } from "@/tenant/features/dashboard/hooks/useDashboardData";
import { useDashboardMetricCards } from "@/tenant/features/dashboard/hooks/useDashboardMetricCards";
import { useModuleAccess } from "@/tenant/hooks/useModuleAccess";
import { useTranslation } from "@/hooks/useTranslation";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { buildDashboardNotifications } from "@/lib/buildDashboardNotifications";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { scrollDocumentToTop } from "@/lib/routing/scrollDocumentToTop";

export function useDashboardPageController() {
  const { t } = useTranslation();
  const { formatCurrency } = useFinanceCurrency();
  const { can } = usePermissions();
  const dashboardRole = (() => resolveDashboardRole(can))();
  // Server-authoritative grant ∧ enablement; all false while loading, so no module widget fetches early.
  const { effectiveModules: enabledModules } = useModuleAccess();

  const {
    disabledCardIds,
    customWidgets,
    gridMode,
    lowAttendanceThreshold,
    urgentAttendanceThreshold,
    toggleCardVisibility,
    toggleWidgetPin,
    unpinWidget,
    deleteWidget,
    saveWidget,
    updatePref,
    updateCustomWidgets,
    reorderCustomWidgets,
  } = useDashboardConfig();

  const [isEditMode, setIsEditMode] = useState(false);
  const [isWidgetBuilderOpen, setIsWidgetBuilderOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<CustomWidget | null>(null);
  const [widgetBuilderType, setWidgetBuilderType] = useState<CustomWidget["widgetType"]>("card");

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
  }, []);

  const openWidgetBuilder = useCallback(
    (type: CustomWidget["widgetType"], widget: CustomWidget | null = null) => {
      if (!canCustomize) return;
      if (!isEditMode) setIsEditMode(true);
      setEditingWidget(widget);
      setWidgetBuilderType(type);
      setIsWidgetBuilderOpen(true);
      scrollDocumentToTop({ behavior: "smooth" });
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

  const handleUpdateGridMode = (mode: "comfortable" | "compact") => {
    updatePref("gridMode", mode);
  };

  const activeCustomCardIds = (() => getActiveCustomCardIds(customWidgets, dashboardRole))();

  const dashboardMetricCards = useDashboardMetricCards({
    customWidgets,
    dashboardRole,
    enabledModules,
    data: dashboardData,
    t,
  });

  const handleEditCustomCard = (customCardId: string) => {
    const widget = customWidgets.find((dashboardWidget) => dashboardWidget.id === customCardId);
    if (widget) handleEditWidget(widget);
  };

  const disabledSet = new Set(disabledCardIds);
  const visibleDashboardMetricCards = dashboardMetricCards.filter(
    (dashboardCard) => !disabledSet.has(dashboardCard.id),
  );

  const selectedDashboardCardCount = visibleDashboardMetricCards.length;

  const visiblePinnedWidgets = customWidgets.filter(
    (widget) =>
      widget.isPinnedToDashboard &&
      widget.widgetType !== "card" &&
      isDashboardWidgetAllowed(widget, enabledModules, can),
  );

  const pinnedDashboardWidgetCount = visiblePinnedWidgets.length;

  const notifications = (() =>
    buildDashboardNotifications(
      dashboardRole,
      {
        outstandingInvoiceCount: financeMetrics?.outstanding ?? 0,
        outstandingBalance: financeMetrics?.outstandingBalance ?? 0,
        attendanceRate:
          attendanceMetrics?.selectedDatePresentRate ??
          attendanceMetrics?.overallPresentRate ??
          null,
        inactiveStudents: studentMetricsInactive,
      },
      t,
      formatCurrency,
      can,
      { lowAttendanceThreshold, urgentAttendanceThreshold },
    ))();

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
    gridMode,
    lowAttendanceThreshold,
    urgentAttendanceThreshold,
    handleUpdateThreshold,
    handleUpdateGridMode,
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
  };
}
