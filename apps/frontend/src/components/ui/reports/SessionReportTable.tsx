import React, { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportDataGridContainer } from "@/components/ui/reports/ReportDataGridContainer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TableCellLink } from "@/components/ui/TableCellLink";
import { ModuleTableHeaderCell } from "@/components/ui/ModuleTableHeaderCell";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { StatGrid, StatRow } from "@/components/ui/StatGrid";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useTranslation } from "@/hooks/useTranslation";
import { utilisationColour } from "./sessionReportUtils";

import type { SessionReportTableProps } from "./sessionReportTypes";
import type { ExportColumn } from "@/components/ui/ExportToolbar";

const UtilisationBar = function UtilisationBar({ rate }: { rate: number }): React.JSX.Element {
  return (
    <ProgressBar
      value={rate}
      fillClassName={utilisationColour(rate)}
      label={`${rate}%`}
      labelClassName="text-foreground"
    />
  );
};

export const SessionReportTable = function SessionReportTable({
  sessionCapacityData,
  sessionStatusConfig,
  onToggleSessionFilter,
  onToggleClassFilter,
}: SessionReportTableProps): React.JSX.Element {
  const { t } = useTranslation();

  const exportColumns = (() => [
    { key: "session", header: t("sessions.report.colSession") },
    { key: "class", header: t("sessions.report.colClass") },
    { key: "enrolled", header: t("sessions.report.colEnrolled") },
    { key: "capacity", header: t("sessions.report.colCapacity") },
    { key: "utilisation", header: t("sessions.report.colUtilisation") },
    { key: "status", header: t("sessions.report.colStatus") },
  ])() as ExportColumn[];

  const exportRows = (() =>
    sessionCapacityData.map((item) => ({
      session: item.session,
      class: item.class,
      enrolled: item.enrolled,
      capacity: item.capacity,
      utilisation: `${item.rate}%`,
      status: sessionStatusConfig[item.status]?.label ?? item.status,
    })))();

  const [page, setPage] = useState(1);
  const pageSize = 15;
  const pagedSessionCapacityData = (() =>
    sessionCapacityData.slice((page - 1) * pageSize, page * pageSize))();

  if (sessionCapacityData.length === 0) {
    return <EmptyState icon={CalendarCheck} title={t("sessions.report.noData")} compact />;
  }

  return (
    <ReportDataGridContainer
      title={t("sessions.report.capacityReportTitle")}
      columns={exportColumns}
      rows={exportRows}
      moduleId="sessions"
      page={page}
      total={sessionCapacityData.length}
      limit={pageSize}
      onPageChange={setPage}
      paginationVariant="range"
      i18nNamespace="sessions"
    >
      <div className="space-y-3 p-3 md:hidden">
        {pagedSessionCapacityData.map((sessionCapacity) => (
          <article
            key={`${sessionCapacity.sessionId}-${sessionCapacity.classId}`}
            className={`${WORK_SURFACE_INNER} space-y-3 p-3`}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <TableCellLink
                  tap
                  onClick={() => onToggleSessionFilter(sessionCapacity.session)}
                  className="max-w-full truncate"
                >
                  {sessionCapacity.session}
                </TableCellLink>
                <TableCellLink
                  tap
                  muted
                  onClick={() => onToggleClassFilter(sessionCapacity.class)}
                  className="text-xs"
                >
                  {sessionCapacity.class}
                </TableCellLink>
              </div>
              <StatusBadge status={sessionCapacity.status} config={sessionStatusConfig} size="sm" />
            </div>
            <StatGrid>
              <StatRow
                className="min-w-0"
                label={t("sessions.report.colEnrolled")}
                value={sessionCapacity.enrolled}
                ddClassName="font-semibold"
              />
              <StatRow
                className="min-w-0"
                label={t("sessions.report.colCapacity")}
                value={sessionCapacity.capacity}
                ddClassName="text-muted-foreground"
              />
              <StatRow
                fullWidth
                label={t("sessions.report.colUtilisation")}
                value={<UtilisationBar rate={sessionCapacity.rate} />}
                dtClassName="mb-1"
              />
            </StatGrid>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{t("sessions.report.capacityReportTitle")}</caption>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
              {[
                {
                  key: "session",
                  label: t("sessions.report.colSession"),
                  variant: "text" as const,
                },
                { key: "class", label: t("sessions.report.colClass"), variant: "text" as const },
                {
                  key: "enrolled",
                  label: t("sessions.report.colEnrolled"),
                  variant: "number" as const,
                },
                {
                  key: "capacity",
                  label: t("sessions.report.colCapacity"),
                  variant: "number" as const,
                },
                {
                  key: "utilisation",
                  label: t("sessions.report.colUtilisation"),
                  variant: "text" as const,
                },
                { key: "status", label: t("sessions.report.colStatus"), variant: "badge" as const },
              ].map((header) => (
                <ModuleTableHeaderCell
                  key={header.key}
                  columnKey={header.key}
                  variant={header.variant}
                  className="px-3 py-2.5"
                >
                  {header.label}
                </ModuleTableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/50">
            {pagedSessionCapacityData.map((sessionCapacity) => (
              <TableRow
                key={`${sessionCapacity.sessionId}-${sessionCapacity.classId}`}
                className="hover:bg-muted/20 transition-colors"
              >
                <TableCell className="px-3 py-2.5 font-medium max-w-cell-md truncate">
                  <TableCellLink
                    onClick={() => onToggleSessionFilter(sessionCapacity.session)}
                    className="max-w-cell-md truncate font-medium"
                  >
                    {sessionCapacity.session}
                  </TableCellLink>
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  <TableCellLink muted onClick={() => onToggleClassFilter(sessionCapacity.class)}>
                    {sessionCapacity.class}
                  </TableCellLink>
                </TableCell>
                <TableCell
                  variant="number"
                  noWrap
                  className="px-3 py-2.5 font-semibold text-foreground"
                >
                  {sessionCapacity.enrolled}
                </TableCell>
                <TableCell variant="number" noWrap className="px-3 py-2.5 text-muted-foreground">
                  {sessionCapacity.capacity}
                </TableCell>
                <TableCell className="px-3 py-2.5 w-36">
                  <UtilisationBar rate={sessionCapacity.rate} />
                </TableCell>
                <TableCell variant="badge" noWrap className="px-3 py-2.5">
                  <StatusBadge
                    status={sessionCapacity.status}
                    config={sessionStatusConfig}
                    size="sm"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportDataGridContainer>
  );
};
