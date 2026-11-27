import React from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import type { ExportColumn } from "@mms/fe-core/components/ExportToolbar";
import { ReportDataGridContainer } from "../../components/ReportDataGridContainer";
import { WorkBatchTable } from "@mms/fe-core/components/WorkBatchTable";
import type { QuestionBankSummaryRow } from "../hooks/useQuestionBankReportData";

export interface QuestionBankSummaryDataGridProps {
  summaryRows: QuestionBankSummaryRow[];
  exportColumns: ExportColumn[];
}

export function QuestionBankSummaryDataGrid({
  summaryRows,
  exportColumns,
}: QuestionBankSummaryDataGridProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ReportDataGridContainer
      title={t("questionBank.analytics.categoryBreakdown")}
      columns={exportColumns}
      rows={summaryRows.map((row: any) => ({ ...row }))}
      moduleId="questionBank"
      hideExport={summaryRows.length === 0}
    >
      <div className="hidden md:block">
        <WorkBatchTable
          data={summaryRows.map((row: any) => ({ ...row, id: `${row.type}-${row.name}` }))}
          columns={[
            {
              id: "type",
              label: t("common.type"),
              headerClassName: "font-bold",
              cellClassName: "text-xs text-muted-foreground uppercase font-bold",
              render: (row: any) => row.type,
            },
            {
              id: "name",
              label: t("common.label"),
              headerClassName: "font-bold",
              cellClassName: "font-medium text-foreground",
              render: (row: any) => row.name,
            },
            {
              id: "questions",
              label: t("questionBank.questions"),
              headerClassName: "font-bold",
              cellClassName: "font-semibold text-primary",
              align: "center",
              noWrap: true,
              render: (row: any) => row.questions,
            },
            {
              id: "tests",
              label: t("questionBank.report.generatedTests"),
              headerClassName: "font-bold",
              cellClassName: "text-muted-foreground",
              align: "center",
              noWrap: true,
              render: (row: any) => row.tests,
            },
          ]}
          bordered={false}
        />
      </div>
      <div className="divide-y divide-border/50 md:hidden" role="list">
        {summaryRows.map((row: any) => (
          <div
            key={`${row.type}-${row.name}`}
            className="flex min-w-0 items-center justify-between gap-3 px-4 py-3"
            role="listitem"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
              <p className="text-xs text-muted-foreground uppercase font-bold">{row.type}</p>
            </div>
            <div className="text-end">
              <span className="font-mono font-bold text-primary">{row.questions}</span>
              <span className="text-xs text-muted-foreground ms-1">
                {t("questionBank.questions").toLowerCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ReportDataGridContainer>
  );
}
