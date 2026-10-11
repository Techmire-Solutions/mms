import React, { lazy, Suspense, useState } from "react";
import { BarChart2, CheckCircle, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { SubTabBar, type SubTab } from "@/components/ui/SubTabBar";
import { AutoGrading } from "@/tenant/components/reports/moduleReportAdapters";
import { PerformanceAnalytics } from "@/tenant/components/reports/moduleReportAdapters";
import { useTranslation } from "@/hooks/useTranslation";
import { ReportFilterBanner } from "@/components/ui/reports/ReportFilterBanner";
import PinnedWidgets from "@/tenant/features/reports/components/PinnedWidgets";
import {
  useQuestionBankReportData,
  type QuestionBankReportFilters,
} from "@/tenant/features/reports/controllers/useQuestionBankReportData";
import { QuestionBankSummaryDataGrid } from "@/tenant/features/reports/components/QuestionBankSummaryDataGrid";

const QuestionBankReportCharts = lazy(() =>
  import("@/components/ui/reports/QuestionBankReportCharts").then((mod) => ({
    default: mod.QuestionBankReportCharts,
  })),
);

export type { QuestionBankReportFilters };

type QBReportSubTab = "overview" | "analytics" | "autoGrading";

export interface QuestionBankReportProps {
  filters?: QuestionBankReportFilters;
  onEditVisual?: (config: unknown) => void;
}

const QuestionBankReport = function QuestionBankReport({
  filters,
}: QuestionBankReportProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<QBReportSubTab>("overview");

  const {
    questions,
    tests,
    results,
    categories,
    difficultyData,
    categoryData,
    hasDifficultyData,
    hasCategoryData,
    exportColumns,
    summaryRows,
    isError,
    refetchAll,
  } = useQuestionBankReportData(filters);

  const tabs: readonly SubTab<QBReportSubTab>[] = [
    { key: "overview", label: t("reports.builder.title"), icon: BarChart2 },
    { key: "analytics", label: t("questionBank.analytics.studentPerformance"), icon: TrendingUp },
    ...(tests.length > 0
      ? [{ key: "autoGrading" as const, label: t("questionBank.aiGrading"), icon: CheckCircle }]
      : []),
  ];

  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          title={t("questionBank.loadFailed")}
          description={t("questionBank.loadFailedHint")}
          onRetry={refetchAll}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ReportFilterBanner
        label={t("reports.filters.title")}
        filters={[
          filters?.status && filters.status !== "all"
            ? {
                key: "status",
                value: filters.status,
              }
            : null,
          filters?.dateFrom || filters?.dateTo
            ? {
                key: "date",
                value: `${filters.dateFrom || ""} - ${filters.dateTo || ""}`,
              }
            : null,
        ]}
      />

      <SubTabBar
        tabs={tabs}
        value={activeSubTab}
        onChange={setActiveSubTab}
        panelIdPrefix="qb-report-subtab"
      />

      {activeSubTab === "overview" && (
        <div className="space-y-4">
          <Suspense fallback={<Skeleton className="h-chart-sm w-full rounded-xl" />}>
            <QuestionBankReportCharts
              difficultyData={difficultyData}
              categoryData={categoryData}
              hasDifficultyData={hasDifficultyData}
              hasCategoryData={hasCategoryData}
            />
          </Suspense>

          {summaryRows.length > 0 && (
            <QuestionBankSummaryDataGrid summaryRows={summaryRows} exportColumns={exportColumns} />
          )}

          <PinnedWidgets category="questionBank" />
        </div>
      )}

      {activeSubTab === "analytics" && (
        <PerformanceAnalytics
          tests={tests}
          results={results}
          questions={questions}
          categories={categories}
        />
      )}

      {activeSubTab === "autoGrading" && tests.length > 0 && (
        <AutoGrading tests={tests} results={results} questions={questions} />
      )}
    </div>
  );
};

export default QuestionBankReport;
