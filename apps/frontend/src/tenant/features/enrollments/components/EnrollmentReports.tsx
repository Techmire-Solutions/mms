import React, { lazy, Suspense } from "react";
import type { ExportColumn } from "@/components/ui/ExportToolbar";
import { ReportDataGridContainer } from "@/tenant/components/moduleReports";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { EnrollmentsReportAggregates } from "@mms/shared";
import { EMPTY_ENROLLMENTS_REPORT_AGGREGATES } from "@mms/shared";
import { ReportFilterBanner } from "@/components/ui/reports/ReportFilterBanner";
import { Skeleton } from "@/components/ui/skeleton";

const EnrollmentReportsCharts = lazy(() =>
  import("./EnrollmentReportsCharts").then((mod) => ({ default: mod.EnrollmentReportsCharts })),
);

import { PinnedWidgets } from "@/tenant/components/reports";

export interface EnrollmentReportsProps {
  aggregates?: EnrollmentsReportAggregates;
  filters?: {
    session?: string;
    status?: string;
  };
}

/**
 * Displays EnrollmentReports KPIs and charts from server report-aggregates.
 */
export function EnrollmentReports({
  aggregates = EMPTY_ENROLLMENTS_REPORT_AGGREGATES,
  filters,
}: EnrollmentReportsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { viewMode } = useWorkDirectoryViewMode();
  const { formatCurrency } = useFinanceCurrency();

  const { bySession } = aggregates;

  const exportColumns = (() => [
    { key: "session", header: t("enrollments.columns.session") },
    { key: "count", header: t("enrollments.metrics.total") },
    { key: "revenue", header: t("enrollments.columns.finalFee") },
  ])() as ExportColumn[];

  const exportRows = (() =>
    bySession.map((sessionStats) => ({
      session: sessionStats.name,
      count: sessionStats.count,
      revenue: formatCurrency(sessionStats.revenue),
    })))();

  return (
    <section className="space-y-6" aria-label={t("enrollments.reports.aria")}>
      <ReportFilterBanner
        label={t("reports.filters.title")}
        filters={[
          filters?.session && filters.session !== "all"
            ? {
                key: "session",
                value: filters.session,
              }
            : null,
          filters?.status && filters.status !== "all"
            ? {
                key: "status",
                value: filters.status,
              }
            : null,
        ]}
      />

      <Suspense fallback={<Skeleton className="h-chart-md w-full rounded-xl" />}>
        <EnrollmentReportsCharts aggregates={aggregates} />
      </Suspense>

      <ReportDataGridContainer
        title={t("enrollments.reports.revenueBySession")}
        columns={exportColumns}
        rows={exportRows}
        moduleId="enrollments"
      >
        {viewMode === "table" ? (
          <WorkBatchTable
            data={bySession.map((s) => ({ ...s, id: `${s.sessionId}:${s.name}` }))}
            columns={[
              {
                id: "session",
                label: t("enrollments.columns.session"),
                headerClassName: "font-bold text-foreground",
                cellClassName: "font-semibold text-foreground",
                render: (row) => row.name,
              },
              {
                id: "count",
                label: t("enrollments.metrics.total"),
                headerClassName: "font-bold text-foreground",
                cellClassName: "text-muted-foreground",
                align: "center",
                noWrap: true,
                render: (row) => row.count,
              },
              {
                id: "revenue",
                label: t("enrollments.columns.finalFee"),
                headerClassName: "font-bold text-foreground",
                cellClassName: "font-bold text-primary",
                align: "right",
                noWrap: true,
                render: (row) => formatCurrency(row.revenue),
              },
            ]}
            emptyState={<EmptyState title={t("enrollments.reports.noData")} compact />}
            bordered={false}
          />
        ) : (
          <div className="divide-y divide-border/50" role="list">
            {bySession.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t("enrollments.reports.noData")}
              </div>
            ) : (
              bySession.map((sessionStats) => (
                <div
                  key={`${sessionStats.sessionId}:${sessionStats.name}`}
                  className="flex min-w-0 items-center justify-between gap-3 px-4 py-3"
                  role="listitem"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {sessionStats.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("enrollments.reports.enrollmentCount", { count: sessionStats.count })}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-primary">
                    {formatCurrency(sessionStats.revenue)}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </ReportDataGridContainer>

      <PinnedWidgets category="enrollments" />
    </section>
  );
}
