import React, { lazy, Suspense } from "react";
import { AlertTriangle, TrendingDown, Award } from "lucide-react";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { AttendanceAnalyticsInsights } from "@/tenant/features/attendance/components/AttendanceAnalyticsInsights";
import { useAttendanceAnalyticsModel } from "@/tenant/features/attendance/hooks/useAttendanceAnalyticsModel";
import { StatsSkeleton } from "@/components/app/LoadingState";
import { ErrorState } from "@/components/app/ErrorState";

const AttendanceAnalyticsChartPanels = lazy(() =>
  import("@/tenant/features/attendance/components/AttendanceAnalyticsChartPanels").then((mod) => ({
    default: mod.AttendanceAnalyticsChartPanels,
  })),
);

export interface AnalyticsFilters {
  classId?: string;
}

export interface AttendanceAnalyticsProps {
  filters: AnalyticsFilters;
}

export function AttendanceAnalytics({ filters }: AttendanceAnalyticsProps): React.JSX.Element {
  const model = useAttendanceAnalyticsModel(filters);

  if (model.isError) {
    return (
      <ErrorState
        title={model.t("attendance.toast.loadFailed")}
        description={model.t("attendance.loadFailedHint")}
        onRetry={() => void model.refetch()}
      />
    );
  }

  if (model.isLoading) return <StatsSkeleton count={4} />;

  return (
    <section className="space-y-6">
      <ModuleCommandMetricsGrid
        items={[
          {
            label: model.t("attendance.analytics.kpi.overallAttendance"),
            value: `${model.overallRate}%`,
            sub: model.t("attendance.analytics.kpi.allClasses"),
            icon: Award,
            accent: "success",
          },
          {
            label: model.t("attendance.analytics.kpi.totalPresent"),
            value: model.totalStats.present ?? 0,
            sub: model.t("attendance.analytics.kpi.allRecords"),
            icon: Award,
            accent: "primary",
          },
          {
            label: model.t("attendance.analytics.kpi.lowAttendance"),
            value: model.lowAttendanceCount,
            sub: model.t("attendance.analytics.kpi.belowThreshold"),
            icon: AlertTriangle,
            accent: "warning",
          },
          {
            label: model.t("attendance.analytics.kpi.mostAbsent"),
            value: model.studentRates[0]?.name || "—",
            sub: `${model.studentRates[0]?.rate || 0}%`,
            icon: TrendingDown,
            accent: "destructive",
          },
        ]}
      />

      <Suspense fallback={<Skeleton className="h-chart-md w-full rounded-xl" />}>
        <AttendanceAnalyticsChartPanels
          t={model.t}
          colors={model.colors}
          classStats={model.classStats}
          monthlyTrend={model.monthlyTrend}
          studentRates={model.studentRates}
          pieData={model.pieData}
          statuses={model.statuses}
          totalStats={model.totalStats}
        />
      </Suspense>

      <AttendanceAnalyticsInsights
        t={model.t}
        lowAttendance={model.lowAttendance}
        lowAttendanceCount={model.lowAttendanceCount}
        topStudents={model.topStudents}
      />
    </section>
  );
}
