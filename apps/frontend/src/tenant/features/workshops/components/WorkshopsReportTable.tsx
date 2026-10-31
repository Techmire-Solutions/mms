import React, { useMemo } from "react";
import type { WorkshopReportRow } from "@mms/shared";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkshopsReport } from "../hooks/useWorkshopsCompletionApi";
import { formatWorkshopDates } from "./workshopsWorkColumns";

type ReportRow = WorkshopReportRow & { id: string };

/** Per-workshop participation, attendance rate and completion for the Reports tier. */
export function WorkshopsReportTable(): React.JSX.Element {
  const { t } = useTranslation();
  const report = useWorkshopsReport();
  const rows = useMemo<ReportRow[]>(
    () => (report.data ?? []).map((row) => ({ ...row, id: row.workshopId })),
    [report.data],
  );

  const columns = useMemo<WorkBatchTableColumn<ReportRow>[]>(
    () => [
      {
        id: "title",
        label: t("workshops.title"),
        width: 240,
        render: (row) => <span className="font-medium text-foreground">{row.title}</span>,
      },
      {
        id: "dates",
        label: t("workshops.dates"),
        width: 200,
        noWrap: true,
        render: (row) => (
          <span className="text-sm">
            {formatWorkshopDates({
              startDate: row.startDate,
              endDate: row.endDate,
            })}
          </span>
        ),
      },
      {
        id: "participants",
        label: t("workshops.participants"),
        width: 120,
        render: (row) => <span className="tabular-nums">{row.participants}</span>,
      },
      {
        id: "attendance",
        label: t("workshops.report.attendanceRate"),
        width: 140,
        render: (row) => (
          <span className="tabular-nums">
            {row.attendancePct === null ? "—" : `${row.attendancePct}%`}
          </span>
        ),
      },
      {
        id: "completed",
        label: t("workshops.completion.completed"),
        width: 120,
        render: (row) => <span className="tabular-nums">{row.completed}</span>,
      },
      {
        id: "certificates",
        label: t("workshops.report.certificates"),
        width: 120,
        render: (row) => <span className="tabular-nums">{row.certificates}</span>,
      },
    ],
    [t],
  );

  if (report.isError) {
    return (
      <ErrorState
        title={t("workshops.loadFailed")}
        description={t("workshops.loadFailedHint")}
        onRetry={() => void report.refetch()}
      />
    );
  }

  return (
    <section aria-labelledby="workshops-report-heading" className="space-y-2">
      <h2 id="workshops-report-heading" className="text-sm font-semibold text-foreground">
        {t("workshops.report.heading")}
      </h2>
      <WorkBatchTable
        data={rows}
        columns={columns}
        isLoading={report.isLoading}
        stickyColumnId="title"
        emptyState={
          <EmptyState title={t("workshops.emptyTitle")} description={t("workshops.report.empty")} />
        }
      />
    </section>
  );
}
