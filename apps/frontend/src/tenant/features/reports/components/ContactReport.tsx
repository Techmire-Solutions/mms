import React, { lazy, Suspense } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useContactsReportAnalytics } from "@/tenant/hooks/collections/contacts";
import { ErrorState } from "@/components/app/ErrorState";
import { ReportChartCard } from "@/components/reports/ReportChartCard";
import { ReportDataGridContainer } from "@/components/reports/ReportDataGridContainer";
import PinnedWidgets from "@/tenant/features/reports/components/PinnedWidgets";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkBatchTable } from "@/components/common/work/WorkBatchTable";
import type { ExportColumn } from "@/components/app/ExportToolbar";

const ContactReportCharts = lazy(() =>
  import("@/components/reports/ContactReportCharts").then((mod) => ({
    default: mod.ContactReportCharts,
  })),
);

interface ContactReportProps {
  onEditVisual?: (config: unknown) => void;
}

/** Contacts CRM Report dashboard — analytics metrics, distribution charts, and pinned widgets. */
const ContactReport = function ContactReport(_props: ContactReportProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const palette = useBrandPalette();
  const analyticsQuery = useContactsReportAnalytics();

  const data = analyticsQuery.data?.status === 200 ? analyticsQuery.data.body : undefined;

  const chartData = (() => {
    if (!data) return [];
    const verified = data.whatsappCount;
    const unverified = Math.max(0, data.total - data.whatsappCount);
    const missing = data.missingInfoCount;
    return [
      {
        name: t("reports.contacts.kpi.whatsappVerified"),
        value: verified,
        color: palette.charts[0] || palette.primary,
      },
      {
        name: t("reports.contacts.kpi.activeContacts"),
        value: unverified,
        color: palette.charts[1] || palette.secondary,
      },
      {
        name: t("reports.contacts.kpi.missingContactInfo"),
        value: missing,
        color: palette.charts[2] || palette.primary,
      },
    ].filter((item) => item.value > 0);
  })();

  const exportColumns = (() => [
    { key: "metric", header: t("common.label") },
    { key: "value", header: t("common.details") },
    { key: "rate", header: t("reports.kpi.growthRate") },
  ])() as ExportColumn[];

  const summaryRows = (() => {
    if (!data || data.total === 0) return [];
    const total = data.total;
    return [
      {
        metric: t("reports.contacts.kpi.totalContacts"),
        value: total,
        rate: "100%",
      },
      {
        metric: t("reports.contacts.kpi.activeContacts"),
        value: data.activeCount,
        rate: `${Math.round((data.activeCount / total) * 100)}%`,
      },
      {
        metric: t("reports.contacts.kpi.whatsappVerified"),
        value: data.whatsappCount,
        rate: `${data.whatsappRate}%`,
      },
      {
        metric: t("reports.contacts.kpi.missingContactInfo"),
        value: data.missingInfoCount,
        rate: `${Math.round((data.missingInfoCount / total) * 100)}%`,
      },
      {
        metric: t("reports.contacts.kpi.newRecently", { count: data.newLast30Days }),
        value: data.newLast30Days,
        rate: `${Math.round((data.newLast30Days / total) * 100)}%`,
      },
    ];
  })();

  if (analyticsQuery.isError) {
    return (
      <div className="p-4">
        <ErrorState
          title={t("contacts.loadFailed")}
          description={t("contacts.loadFailedHint")}
          onRetry={() => void analyticsQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-start">
      {analyticsQuery.isLoading ? (
        <Skeleton className="h-chart-md w-full rounded-2xl" />
      ) : chartData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ReportChartCard
            title={t("reports.contacts.kpi.totalContacts")}
            subtitle={t("reports.contacts.kpi.whatsappSub")}
            heightClass="h-chart-md"
          >
            <Suspense fallback={<Skeleton className="h-full w-full rounded-xl" />}>
              <ContactReportCharts chartData={chartData} />
            </Suspense>
          </ReportChartCard>

          <ReportDataGridContainer
            title={t("reports.contacts.kpi.totalContacts")}
            columns={exportColumns}
            rows={summaryRows.map((row) => ({ ...row }))}
            moduleId="contacts"
            hideExport={summaryRows.length === 0}
          >
            <div className="hidden md:block">
              <WorkBatchTable
                data={summaryRows.map((row) => ({ ...row, id: row.metric }))}
                columns={[
                  {
                    id: "metric",
                    label: t("common.label"),
                    render: (row) => <span className="font-medium">{row.metric}</span>,
                  },
                  {
                    id: "value",
                    label: t("common.details"),
                    align: "center",
                    cellClassName: "font-mono",
                    noWrap: true,
                    render: (row) => row.value,
                  },
                  {
                    id: "rate",
                    label: t("reports.kpi.growthRate"),
                    align: "right",
                    cellClassName: "text-primary font-bold",
                    noWrap: true,
                    render: (row) => row.rate,
                  },
                ]}
                bordered={false}
              />
            </div>
            <div className="divide-y divide-border/50 md:hidden" role="list">
              {summaryRows.map((row) => (
                <div
                  key={row.metric}
                  className="flex min-w-0 items-center justify-between gap-3 px-4 py-3"
                  role="listitem"
                >
                  <span className="truncate text-sm font-medium text-foreground">{row.metric}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-sm text-muted-foreground">{row.value}</span>
                    <span className="font-mono text-sm font-bold text-primary">{row.rate}</span>
                  </div>
                </div>
              ))}
            </div>
          </ReportDataGridContainer>
        </div>
      ) : null}

      <PinnedWidgets category="contacts" />
    </div>
  );
};

export default ContactReport;
