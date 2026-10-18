import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import {
  computeContactsCustomCardValue,
  computeStudentsCustomCardValue,
  computeFacultyCustomCardValue,
  computeSessionsCustomCardValue,
} from "@/lib/reports/widgetDataUtils";
import {
  isSeededDashboardWidget,
  resolveWidgetTitle,
  resolveWidgetSubText,
  type StatItem,
} from "@/lib/dashboardWidgets";
import { resolveDashboardTrendMetric, TREND_METRIC_KEY_MAP } from "@/lib/dashboardCollections";
import { resolveCardVisuals } from "@/lib/ui/dashboardWidgetColors";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { DashboardMetricTrends } from "@/tenant/features/dashboard/hooks/dashboardMetricTrends";
import type { useDashboardData } from "@/tenant/features/dashboard/hooks/useDashboardData";
import { resolveServerMetricValue } from "./dashboardCollectionMetricResolvers";

type DashboardData = ReturnType<typeof useDashboardData>;

interface BuildDashboardMetricCardArgs {
  widget: CustomWidget;
  data: DashboardData;
  trends: DashboardMetricTrends;
  t: TranslationFunction;
}

const CUSTOM_CARD_EVALUATORS = {
  contacts: {
    computeFn: computeContactsCustomCardValue,
    totalKey: "contactsTotal",
    trendKey: "contactTrend",
  },
  students: {
    computeFn: computeStudentsCustomCardValue,
    totalKey: "studentsTotal",
    trendKey: "studentTrend",
  },
  faculty: {
    computeFn: computeFacultyCustomCardValue,
    totalKey: "facultyTotal",
    trendKey: "facultyTrend",
  },
  sessions: {
    computeFn: computeSessionsCustomCardValue,
    totalKey: "sessionsTotal",
    trendKey: "sessionsTrend",
  },
} as const;

function tryCustomCollectionCardValue(
  widget: CustomWidget,
  computeFn: (args: {
    id: string;
    operation: NonNullable<CustomWidget["operation"]>;
    targetField?: string;
    filterField?: string;
    filterOperator?: CustomWidget["filterOperator"];
    filterValue?: string;
  }) => { finalValue: string | number } | null,
  totalCount: number,
  t: TranslationFunction,
): { value: string; sub: string } | null {
  const aggregateValue = computeFn({
    id: widget.id,
    operation: widget.operation || "count",
    targetField: widget.targetField,
    filterField: widget.filterField,
    filterOperator: widget.filterOperator,
    filterValue: widget.filterValue,
  });
  if (!aggregateValue) return null;

  return {
    value: String(aggregateValue.finalValue),
    sub:
      resolveWidgetSubText(widget, t) || t("reports.widgets.totalCountText", { count: totalCount }),
  };
}

export function buildDashboardMetricCard({
  widget,
  data,
  trends,
  t,
}: BuildDashboardMetricCardArgs): StatItem {
  let resolvedMetric: { value: string; sub?: string } | null = null;
  let customTrend: number | undefined;

  const customEvaluator = isSeededDashboardWidget(widget.id)
    ? undefined
    : CUSTOM_CARD_EVALUATORS[widget.collection as keyof typeof CUSTOM_CARD_EVALUATORS];
  if (customEvaluator) {
    resolvedMetric = tryCustomCollectionCardValue(
      widget,
      customEvaluator.computeFn,
      data[customEvaluator.totalKey],
      t,
    );
    if (resolvedMetric) {
      customTrend = trends[customEvaluator.trendKey];
    }
  }

  if (!resolvedMetric) {
    resolvedMetric = resolveServerMetricValue(widget, data);
  }

  const value = resolvedMetric?.value ?? "0";
  const sub = resolvedMetric?.sub ?? resolveWidgetSubText(widget, t);

  const trendMetric = resolveDashboardTrendMetric(widget.id);
  const trendKey = trendMetric ? TREND_METRIC_KEY_MAP[trendMetric] : undefined;
  const resolvedTrend =
    customTrend ??
    (trendKey && typeof trends[trendKey] === "number"
      ? trends[trendKey]
      : widget.trendType === "database"
        ? 0
        : typeof widget.trend === "number"
          ? widget.trend
          : 0);

  const { icon, color } = resolveCardVisuals(widget);

  return {
    id: widget.id,
    title: resolveWidgetTitle(widget, t),
    value,
    sub,
    icon,
    color,
    trend: resolvedTrend,
  };
}
