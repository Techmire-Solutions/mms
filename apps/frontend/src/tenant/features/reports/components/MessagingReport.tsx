import React, { lazy, Suspense } from "react";
import { MessageSquareOff } from "lucide-react";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ErrorState } from "@/components/app/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { MESSAGING_MODULE_MANIFEST } from "@mms/shared";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { MessagingReportHeaderBar } from "@/components/reports/MessagingReportHeaderBar";
import { MessagingReportSummaryTable } from "@/components/reports/MessagingReportSummaryTable";
import { MessagingReportChannelStats } from "@/tenant/features/reports/components/MessagingReportChannelStats";
import { useMessagingReportData } from "@/tenant/features/reports/hooks/useMessagingReportData";
import PinnedWidgets from "@/tenant/features/reports/components/PinnedWidgets";

const MessagingReportsVolumeChart = lazy(() =>
  import("@/tenant/components/reports/MessagingReportsVolumeChart").then((m) => ({
    default: m.MessagingReportsVolumeChart,
  })),
);

export interface MessagingReportProps {
  canWrite?: boolean;
}

export default function MessagingReport({
  canWrite: canWriteProp,
}: MessagingReportProps = {}): React.JSX.Element {
  const { canWrite: canWritePermission } = useModulePermissions(MESSAGING_MODULE_MANIFEST);
  const canWrite = canWriteProp ?? canWritePermission;
  const { t } = useTranslation();

  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    exporting,
    metricsQuery,
    stats,
    total,
    chartData,
    showSkeleton,
    calcPercentage,
    applyPreset,
    exportAllFilteredLogs,
    channelExportColumns,
    channelSummaryRows,
  } = useMessagingReportData(t, canWrite);

  if (metricsQuery.isError) {
    return (
      <ErrorState
        title={t("messaging.loadFailed")}
        description={t("messaging.loadFailedHint")}
        onRetry={() => void metricsQuery.refetch()}
      />
    );
  }

  return (
    <ErrorBoundary>
      <MessagingReportHeaderBar
        startDate={startDate}
        endDate={endDate}
        exporting={exporting}
        canWrite={canWrite}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApplyPreset={applyPreset}
        onExport={() => void exportAllFilteredLogs()}
        t={t}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mt-4">
        <div className="lg:col-span-2">
          {showSkeleton ? (
            <Skeleton
              className="h-chart-lg w-full rounded-xl border border-border"
              role="status"
              aria-busy="true"
            />
          ) : total === 0 ? (
            <div
              className={`${WORK_SURFACE} p-8 flex flex-col items-center justify-center text-center h-full min-h-64 rounded-xl space-y-2`}
            >
              <MessageSquareOff className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">{t("messaging.noLogs")}</p>
              <p className="text-xs text-muted-foreground">{t("messaging.selectRecipientsDesc")}</p>
            </div>
          ) : (
            <Suspense
              fallback={
                <Skeleton
                  className="h-chart-lg w-full rounded-xl border border-border"
                  aria-hidden
                />
              }
            >
              <MessagingReportsVolumeChart chartData={chartData} />
            </Suspense>
          )}
        </div>

        <MessagingReportChannelStats
          stats={stats}
          total={total}
          calcPercentage={calcPercentage}
          t={t}
        />
      </div>

      {total > 0 && (
        <div className="mt-4">
          <MessagingReportSummaryTable
            title={t("messaging.channel")}
            columns={channelExportColumns}
            rows={channelSummaryRows}
            detailsHeader={t("common.details")}
            growthRateHeader={t("reports.kpi.growthRate")}
          />
        </div>
      )}

      <div className="mt-4">
        <PinnedWidgets category="messaging" />
      </div>
    </ErrorBoundary>
  );
}
