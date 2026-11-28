import { useMemo } from "react";
import type { Permission } from "@mms/contracts";
import type { CustomWidget } from "@mms/mod-analytics/frontend/tenant/lib/pinnedWidgetTypes";
import type { DashboardRole } from "../../../lib/dashboardRole";
import {
  isDashboardWidgetAllowed,
  filterDashboardCardWidgets,
} from "../../../lib/dashboardCollections";
import type { StatItem } from "../../../lib/dashboardWidgets";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import type { useDashboardData } from "./useDashboardData";
import { computeDashboardMetricTrends } from "./dashboardMetricTrends";
import { buildDashboardMetricCard } from "./buildDashboardMetricCard";

type DashboardData = ReturnType<typeof useDashboardData>;

interface UseDashboardMetricCardsArgs {
  customWidgets: CustomWidget[];
  dashboardRole: DashboardRole;
  enabledModules: Record<string, boolean | undefined>;
  can?: (permission: Permission) => boolean;
  data: DashboardData;
  t: TranslationFunction;
  formatCurrency?: (amount: number | string | null | undefined) => string;
}

/**
 * Builds role-scoped, module-filtered dashboard KPI cards with live trends.
 *
 * Memoized: the dashboard re-renders on every customize-panel interaction, and
 * rebuilding every card (plus the trend math) each keystroke is wasted work.
 */
export function useDashboardMetricCards({
  customWidgets,
  dashboardRole,
  enabledModules,
  can,
  data,
  t,
  formatCurrency,
}: UseDashboardMetricCardsArgs): StatItem[] {
  return useMemo(() => {
    const trends = computeDashboardMetricTrends(data);

    const dashboardCardWidgets = filterDashboardCardWidgets(customWidgets, dashboardRole);
    // Match the pinned-widget path: a card whose module is enabled but whose
    // read permission the role lacks must not render as an authoritative zero.
    const enabledDashboardCardWidgets = dashboardCardWidgets.filter((widget: any) =>
      isDashboardWidgetAllowed(widget, enabledModules, can),
    );

    return enabledDashboardCardWidgets.map((widget: any) =>
      buildDashboardMetricCard({ widget, data, trends, t, formatCurrency }),
    );
  }, [customWidgets, dashboardRole, enabledModules, can, data, t, formatCurrency]);
}
