import React from "react";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";

const SessionsTable = React.lazy(() => import("@/components/dashboard-widgets/SessionsTable"));
const OutstandingFeesTable = React.lazy(
  () => import("@/components/dashboard-widgets/OutstandingFeesTable"),
);
const FeeCollectionSummary = React.lazy(
  () => import("@/components/dashboard-widgets/FeeCollectionSummary"),
);
const OverdueObligationsWidget = React.lazy(
  () => import("@/components/dashboard-widgets/OverdueObligationsWidget"),
);
const TodayAttendanceWidget = React.lazy(
  () => import("@/components/dashboard-widgets/TodayAttendanceWidget"),
);
const EnrollmentChart = React.lazy(
  () => import("@/components/dashboard-widgets/charts/EnrollmentChart"),
);
const RevenueChart = React.lazy(() => import("@/components/dashboard-widgets/charts/RevenueChart"));
const AttendanceChart = React.lazy(() =>
  import("@/components/dashboard-widgets/charts/AttendanceChart").then((module) => ({
    default: module.AttendanceChart,
  })),
);
const HasanatChart = React.lazy(() =>
  import("@/components/dashboard-widgets/charts/HasanatChart").then((module) => ({
    default: module.HasanatChart,
  })),
);

/** Composed (non-KPI) dashboard / reports widget type ids. */
export const COMPOSED_WIDGET_TYPES = [
  "sessions-list",
  "attendance-summary",
  "fee-summary",
  "outstanding-list",
  "overdue-obligations",
  "enrollment-trends",
  "revenue-expenses",
  "attendance-rate",
  "hasanat-distribution",
] as const;

export type ComposedWidgetType = (typeof COMPOSED_WIDGET_TYPES)[number];

/** List/summary widgets that skip metric field builders in WidgetBuilder. */
export const LIST_SUMMARY_WIDGET_TYPES = [
  "sessions-list",
  "attendance-summary",
  "fee-summary",
  "outstanding-list",
  "overdue-obligations",
] as const;

export function isComposedWidgetType(type: string | undefined): type is ComposedWidgetType {
  return Boolean(type && (COMPOSED_WIDGET_TYPES as readonly string[]).includes(type));
}

export function isListSummaryWidgetType(type: string | undefined): boolean {
  return Boolean(type && (LIST_SUMMARY_WIDGET_TYPES as readonly string[]).includes(type));
}

/** Title-bearing list/summary widgets — same set as LIST_SUMMARY_WIDGET_TYPES. */
const TITLE_WIDGETS = new Set<ComposedWidgetType>(LIST_SUMMARY_WIDGET_TYPES);

const FALLBACK_CLASS = {
  compact: "min-h-card-compact rounded-3xl",
  tall: "min-h-preview-tall rounded-3xl",
} as const;

interface ComposedDashboardWidgetProps {
  type: ComposedWidgetType;
  title: string;
  isEditMode?: boolean;
}

/**
 * Config-driven composed widget renderer (shared by dashboard pins and report embeds).
 */
export function ComposedDashboardWidget({
  type,
  title,
  isEditMode = false,
}: ComposedDashboardWidgetProps): React.JSX.Element {
  const fallbackClass = TITLE_WIDGETS.has(type) ? FALLBACK_CLASS.compact : FALLBACK_CLASS.tall;

  let content: React.ReactNode;
  switch (type) {
    case "sessions-list":
      content = <SessionsTable title={title} />;
      break;
    case "attendance-summary":
      content = <TodayAttendanceWidget title={title} />;
      break;
    case "fee-summary":
      content = <FeeCollectionSummary title={title} />;
      break;
    case "outstanding-list":
      content = <OutstandingFeesTable title={title} />;
      break;
    case "overdue-obligations":
      content = <OverdueObligationsWidget title={title} />;
      break;
    case "enrollment-trends":
      content = <EnrollmentChart isEditMode={isEditMode} />;
      break;
    case "revenue-expenses":
      content = <RevenueChart isEditMode={isEditMode} />;
      break;
    case "attendance-rate":
      content = <AttendanceChart isEditMode={isEditMode} />;
      break;
    case "hasanat-distribution":
      content = <HasanatChart isEditMode={isEditMode} />;
      break;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }

  return (
    <ErrorBoundary>
      <React.Suspense fallback={<Skeleton className={fallbackClass} />}>{content}</React.Suspense>
    </ErrorBoundary>
  );
}
