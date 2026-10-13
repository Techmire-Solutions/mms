import React, { lazy, Suspense, useState } from "react";
import type { SessionsReportAggregates } from "@mms/shared";
import {
  useSessions,
  useSessionsCollection,
  useSessionsReportAggregates,
} from "@/tenant/hooks/collections/sessions";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";
import { useTranslation } from "@/hooks/useTranslation";
import { SessionReportTable } from "@/components/reports/SessionReportTable";
import { SessionReportDashboardWidgets } from "@/components/reports/SessionReportDashboardWidgets";
import { ReportFilterBanner } from "@/components/reports/ReportFilterBanner";
import PinnedWidgets from "@/tenant/features/reports/components/PinnedWidgets";

const SessionReportCharts = lazy(() =>
  import("@/components/reports/SessionReportCharts").then((mod) => ({
    default: mod.SessionReportCharts,
  })),
);

import {
  buildEnrollmentTrends,
  buildSessionCapacityData,
  buildTodaysSessions,
  buildSessionStatusConfig,
} from "@/components/reports/sessionReportUtils";

import type {
  CapacityChartItem,
  EnrollmentTrendItem,
  SessionCapacityItem,
  SessionReportProps,
  TodaySessionItem,
} from "@/components/reports/sessionReportTypes";

export type {
  CapacityChartItem,
  EnrollmentTrendItem,
  SessionCapacityItem,
  SessionReportFilters,
  SessionReportProps,
  TodaySessionItem,
} from "@/components/reports/sessionReportTypes";

/**
 * Renders the session reports and capacity metrics, including utilization bar charts,
 * enrollment trend lines, and a filterable capacity data grid.
 */
const SessionReport = function SessionReport({ filters }: SessionReportProps): React.JSX.Element {
  const { t } = useTranslation();
  const sessionsQuery = useSessions();
  const sessions = useSessionsCollection();
  const aggregatesQuery = useSessionsReportAggregates();
  const aggregates =
    aggregatesQuery.data?.status === 200
      ? (aggregatesQuery.data.body as SessionsReportAggregates)
      : undefined;
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const sessionStatusConfig = (() => buildSessionStatusConfig(t))();

  const rawSessionCapacityData = (() => {
    if (aggregates && Array.isArray(aggregates.capacity) && aggregates.capacity.length > 0) {
      return aggregates.capacity;
    }
    return buildSessionCapacityData(sessions);
  })() as SessionCapacityItem[];

  const capacityChartData = (() => {
    return rawSessionCapacityData.map((item: SessionCapacityItem) => ({
      class: item.class,
      enrolled: item.enrolled,
      available: Math.max(0, item.capacity - item.enrolled),
    }));
  })() as CapacityChartItem[];

  const enrollmentTrends = (() => {
    if (
      aggregates &&
      Array.isArray(aggregates.enrollmentTrends) &&
      aggregates.enrollmentTrends.length > 0
    ) {
      return aggregates.enrollmentTrends.map((trend) => ({
        month: trend.monthKey,
        students: trend.students,
        sessionName: trend.sessionName,
      }));
    }
    return buildEnrollmentTrends(sessions);
  })() as EnrollmentTrendItem[];

  const sessionCapacityData = (() => {
    let filteredData = rawSessionCapacityData;

    if (filters.session && filters.session !== "all") {
      filteredData = filteredData.filter((item) => item.sessionId === filters.session);
    }
    if (filters.class && filters.class !== "all") {
      filteredData = filteredData.filter((item) => item.classId === filters.class);
    }
    if (filters.status && filters.status !== "all") {
      filteredData = filteredData.filter((item) => item.status === filters.status);
    }
    if (selectedSession) {
      filteredData = filteredData.filter((item) => item.session === selectedSession);
    }
    if (selectedClass) {
      filteredData = filteredData.filter((item) => item.class === selectedClass);
    }

    return filteredData;
  })() as SessionCapacityItem[];

  const todaysSessions = (() => {
    if (
      aggregates &&
      Array.isArray(aggregates.todaysSessions) &&
      aggregates.todaysSessions.length > 0
    ) {
      return aggregates.todaysSessions;
    }
    return buildTodaysSessions(sessions);
  })() as TodaySessionItem[];

  const toggleSessionFilter = (sessionName: string): void => {
    setSelectedSession((currentSession) => (currentSession === sessionName ? null : sessionName));
  };

  const toggleClassFilter = (className: string): void => {
    setSelectedClass((currentClass) => (currentClass === className ? null : className));
  };

  if (sessionsQuery.isError || aggregatesQuery.isError) {
    return (
      <ErrorState
        title={t("sessions.loadFailed")}
        description={t("sessions.loadFailedHint")}
        onRetry={() => {
          void sessionsQuery.refetch();
          void aggregatesQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Suspense fallback={<Skeleton className="h-chart-md w-full rounded-xl" />}>
        <SessionReportCharts
          capacityChartData={capacityChartData}
          enrollmentTrends={enrollmentTrends}
          onToggleClassFilter={toggleClassFilter}
          onToggleSessionFilter={toggleSessionFilter}
        />
      </Suspense>

      <ReportFilterBanner
        filters={[
          selectedSession
            ? {
                key: "session",
                label: t("sessions.report.sessionFilterLabel"),
                value: selectedSession,
                onClear: () => setSelectedSession(null),
                clearLabel: t("sessions.report.clearSessionFilter"),
              }
            : null,
          selectedClass
            ? {
                key: "class",
                label: t("sessions.report.classFilterLabel"),
                value: selectedClass,
                onClear: () => setSelectedClass(null),
                clearLabel: t("sessions.report.clearClassFilter"),
              }
            : null,
        ]}
      />

      <SessionReportTable
        sessionCapacityData={sessionCapacityData}
        sessionStatusConfig={sessionStatusConfig}
        onToggleSessionFilter={toggleSessionFilter}
        onToggleClassFilter={toggleClassFilter}
      />

      <SessionReportDashboardWidgets todaysSessions={todaysSessions} />
      <PinnedWidgets category="sessions" />
    </div>
  );
};

export default SessionReport;
