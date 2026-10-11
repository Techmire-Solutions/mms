import type { ReportCollection } from "@/lib/reports/reportMetadata";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { widgetMatchesDashboardRole, type DashboardRole } from "@/lib/dashboardRole";
import { isSeededDashboardWidget, DASHBOARD_WIDGET_REGISTRY } from "@/lib/dashboardWidgets";
import type { DashboardTrendMetric, DashboardMetricTrends, Permission } from "@mms/shared";
import {
  DASHBOARD_COLLECTION_MODULE_ID,
  DASHBOARD_ACCOUNTING_WIDGET_IDS,
  getDashboardWidgetRequiredPermission,
  isDashboardWidgetPermitted,
  isDashboardWidgetModuleEnabled,
  isDashboardWidgetAllowed,
} from "./dashboardWidgetPermissions";

export type { DashboardTrendMetric };
export {
  DASHBOARD_COLLECTION_MODULE_ID,
  DASHBOARD_ACCOUNTING_WIDGET_IDS,
  getDashboardWidgetRequiredPermission,
  isDashboardWidgetPermitted,
  isDashboardWidgetModuleEnabled,
  isDashboardWidgetAllowed,
};

const REVENUE_WIDGET_TYPES = new Set(["revenue-expenses"]);

export const TREND_METRIC_KEY_MAP: Record<DashboardTrendMetric, keyof DashboardMetricTrends> = {
  attendance: "attendanceTrend",
  fees: "feesTrend",
  outstanding: "outstandingTrend",
  hasanat: "hasanatTrend",
  sessions: "sessionsTrend",
  contacts: "contactTrend",
  students: "studentTrend",
  faculty: "facultyTrend",
};

/** Filters custom widgets to active card-type widgets matching the dashboard role. */
export function filterDashboardCardWidgets(
  widgets: CustomWidget[],
  dashboardRole: DashboardRole,
): CustomWidget[] {
  return widgets.filter(
    (widget) =>
      widget.widgetType === "card" && widgetMatchesDashboardRole(widget.role, dashboardRole),
  );
}

/** Explicit trend source for seeded metric cards — sourced from
 *  `DASHBOARD_WIDGET_REGISTRY` (see `dashboardWidgets.ts`). Custom cards
 *  fall back to id heuristics below. */
export function resolveDashboardTrendMetric(widgetId: string): DashboardTrendMetric | undefined {
  const mapped = DASHBOARD_WIDGET_REGISTRY[widgetId]?.trendMetric;
  if (mapped) return mapped;

  // Custom (non-seeded) cards: best-effort id heuristics.
  const id = widgetId.toLowerCase();
  if (id.includes("attendance") || id.includes("rate")) return "attendance";
  if (id.includes("fees") || id.includes("revenue") || id.includes("income")) return "fees";
  if (id.includes("outstanding") || id.includes("debt") || id.includes("overdue"))
    return "outstanding";
  if (id.includes("hasanat") || id.includes("points")) return "hasanat";
  if (id.includes("sessions") || id.includes("classes")) return "sessions";
  return undefined;
}

/** Predicate checking if a widget is active (pinned or role-scoped metric card) on the dashboard layout. */
export function isWidgetActiveForDashboard(
  widget: Pick<CustomWidget, "role" | "widgetType" | "isPinnedToDashboard">,
  dashboardRole: DashboardRole,
): boolean {
  return (
    Boolean(widget.isPinnedToDashboard) ||
    (widget.widgetType === "card" && widgetMatchesDashboardRole(widget.role, dashboardRole))
  );
}

/** Filters widgets matching a specific collection that are active for the active dashboard role. */
export function filterDashboardWidgetsByCollection(
  widgets: CustomWidget[],
  collection: ReportCollection,
  dashboardRole: DashboardRole,
): CustomWidget[] {
  return widgets.filter(
    (widget) =>
      widget.collection === collection && isWidgetActiveForDashboard(widget, dashboardRole),
  );
}

/**
 * Collections referenced by visible dashboard cards and pinned widgets.
 * Used to gate `/metrics` fetches — not full collection dumps.
 */
export function getRequiredDashboardCollections(
  widgets: CustomWidget[],
  dashboardRole: DashboardRole,
  enabledModules?: Record<string, boolean | undefined>,
  can?: (permission: Permission) => boolean,
): Set<ReportCollection> {
  const required = new Set<ReportCollection>();

  for (const widget of widgets) {
    if (enabledModules && !isDashboardWidgetModuleEnabled(widget, enabledModules)) {
      continue;
    }
    if (can && !isDashboardWidgetPermitted(widget, can)) {
      continue;
    }

    const isActive = isWidgetActiveForDashboard(widget, dashboardRole);
    const isPinnedWidget = Boolean(widget.isPinnedToDashboard);

    if (isActive) {
      required.add(widget.collection);
    }

    if (isPinnedWidget && widget.widgetType && REVENUE_WIDGET_TYPES.has(widget.widgetType)) {
      required.add("finance_invoices");
    }
  }

  return required;
}

/** Returns custom (user-created, non-seeded) card widget IDs active for the active dashboard role. */
export function getActiveCustomCardIds(
  widgets: CustomWidget[],
  dashboardRole: DashboardRole,
): string[] {
  return filterDashboardCardWidgets(widgets, dashboardRole)
    .filter((widget) => !isSeededDashboardWidget(widget.id))
    .map((widget) => widget.id);
}

/** Count of widgets pinned to the dashboard layout. */
export function getPinnedDashboardWidgetCount(
  widgets: CustomWidget[],
  enabledModules?: Record<string, boolean | undefined>,
  can?: (permission: Permission) => boolean,
): number {
  return widgets.filter((widget) => {
    if (!widget.isPinnedToDashboard || widget.widgetType === "card") return false;
    if (enabledModules && !isDashboardWidgetModuleEnabled(widget, enabledModules)) return false;
    if (can && !isDashboardWidgetPermitted(widget, can)) return false;
    return true;
  }).length;
}
