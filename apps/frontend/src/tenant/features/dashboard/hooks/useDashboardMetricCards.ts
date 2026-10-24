import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import type { DashboardRole } from "@/lib/dashboardRole";
import {
  isDashboardWidgetModuleEnabled,
  filterDashboardCardWidgets,
} from "@/lib/dashboardCollections";
import type { StatItem } from "@/lib/dashboardWidgets";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { useDashboardData } from "@/tenant/features/dashboard/hooks/useDashboardData";
import { computeDashboardMetricTrends } from "@/tenant/features/dashboard/hooks/dashboardMetricTrends";
import { buildDashboardMetricCard } from "@/tenant/features/dashboard/hooks/buildDashboardMetricCard";

type DashboardData = ReturnType<typeof useDashboardData>;

interface UseDashboardMetricCardsArgs {
  customWidgets: CustomWidget[];
  dashboardRole: DashboardRole;
  enabledModules: Record<string, boolean | undefined>;
  data: DashboardData;
  t: TranslationFunction;
}

/**
 * Builds role-scoped, module-filtered dashboard KPI cards with live trends.
 */
export function useDashboardMetricCards({
  customWidgets,
  dashboardRole,
  enabledModules,
  data,
  t,
}: UseDashboardMetricCardsArgs): StatItem[] {
  return (() => {
    const trends = computeDashboardMetricTrends(data);

    const dashboardCardWidgets = filterDashboardCardWidgets(customWidgets, dashboardRole);
    const enabledDashboardCardWidgets = dashboardCardWidgets.filter((widget) =>
      isDashboardWidgetModuleEnabled(widget, enabledModules),
    );

    return enabledDashboardCardWidgets.map((widget) =>
      buildDashboardMetricCard({ widget, data, trends, t }),
    );
  })();
}
