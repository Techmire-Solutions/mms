import React from "react";
import { UserCheck } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { ReportDataGridContainer } from "@/components/reports/ReportDataGridContainer";
import { ModuleTableHeaderCell } from "@/components/app/ModuleTableHeaderCell";
import { TableCellLink } from "@shared/ui";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { Badge } from "@/components/ui/badge";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import { useTranslation } from "@/hooks/useTranslation";
import type { AttendanceSummaryItem, RateBarRenderer } from "./attendanceReportTypes";
import type { ExportColumn } from "@/components/app/ExportToolbar";

export interface AttendanceSummaryTableProps {
  summary: AttendanceSummaryItem[];
  rateBar: RateBarRenderer;
  onToggleClassFilter: (className: string) => void;
}

export function AttendanceSummaryTable({
  summary,
  rateBar,
  onToggleClassFilter,
}: AttendanceSummaryTableProps): React.JSX.Element {
  const { t } = useTranslation();

  const summaryColumns = [
    { key: "class", header: t("attendance.report.colClass") },
    { key: "total", header: t("attendance.report.colTotalStudents") },
    { key: "avgRate", header: t("attendance.report.colAvgRate") },
    { key: "perfectAttendance", header: t("attendance.report.colPerfectAttendance") },
    { key: "belowThreshold", header: t("attendance.report.colBelowThreshold") },
  ] as ExportColumn[];

  const summaryRows = summary.map((summaryRow) => ({
    class: summaryRow.class,
    total: summaryRow.total,
    avgRate: `${summaryRow.avgRate}%`,
    perfectAttendance: summaryRow.perfectAttendance,
    belowThreshold: summaryRow.belowThreshold,
  }));

  if (summary.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        title={t("attendance.report.noData")}
        description={t("attendance.report.adjustFilters")}
        compact
      />
    );
  }

  return (
    <ReportDataGridContainer
      title={t("attendance.report.summaryTitle")}
      columns={summaryColumns}
      rows={summaryRows}
      moduleId="attendance"
    >
      <div className="space-y-3 p-3 md:hidden">
        {summary.map((summaryRow) => (
          <article key={summaryRow.class} className={`${WORK_SURFACE_INNER} space-y-3 p-3`}>
            <TableCellLink tap onClick={() => onToggleClassFilter(summaryRow.class)}>
              {summaryRow.class}
            </TableCellLink>
            <StatGrid>
              <StatRow
                className="min-w-0"
                label={t("attendance.report.colTotalStudents")}
                value={summaryRow.total}
              />
              <StatRow
                className="min-w-0"
                label={t("attendance.report.colAvgRate")}
                value={rateBar(summaryRow.avgRate)}
              />
              <StatRow
                className="min-w-0"
                label={t("attendance.report.colPerfectAttendance")}
                value={
                  <Badge pill tone="success">
                    {summaryRow.perfectAttendance}
                  </Badge>
                }
              />
              <StatRow
                className="min-w-0"
                label={t("attendance.report.colBelowThreshold")}
                value={
                  <Badge pill tone="destructive">
                    {summaryRow.belowThreshold}
                  </Badge>
                }
              />
            </StatGrid>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{t("attendance.report.summaryTitle")}</caption>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
              <ModuleTableHeaderCell columnKey="class" className="px-3 py-2.5">
                {t("attendance.report.colClass")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell
                columnKey="totalStudents"
                variant="number"
                className="px-3 py-2.5"
              >
                {t("attendance.report.colTotalStudents")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell columnKey="avgRate" className="px-3 py-2.5">
                {t("attendance.report.colAvgRate")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell
                columnKey="perfectAttendance"
                variant="badge"
                className="px-3 py-2.5"
              >
                {t("attendance.report.colPerfectAttendance")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell
                columnKey="belowThreshold"
                variant="badge"
                className="px-3 py-2.5"
              >
                {t("attendance.report.colBelowThreshold")}
              </ModuleTableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/50">
            {summary.map((summaryRow) => (
              <TableRow key={summaryRow.class} className="hover:bg-muted/20 transition-colors">
                <TableCell className="px-3 py-2.5 font-medium text-foreground">
                  <TableCellLink tap onClick={() => onToggleClassFilter(summaryRow.class)}>
                    {summaryRow.class}
                  </TableCellLink>
                </TableCell>
                <TableCell variant="number" noWrap className="px-3 py-2.5 text-muted-foreground">
                  {summaryRow.total}
                </TableCell>
                <TableCell className="px-3 py-2.5 w-36">{rateBar(summaryRow.avgRate)}</TableCell>
                <TableCell variant="badge" noWrap className="px-3 py-2.5">
                  <Badge pill tone="success">
                    {summaryRow.perfectAttendance}
                  </Badge>
                </TableCell>
                <TableCell variant="badge" noWrap className="px-3 py-2.5">
                  <Badge pill tone="destructive">
                    {summaryRow.belowThreshold}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportDataGridContainer>
  );
}
