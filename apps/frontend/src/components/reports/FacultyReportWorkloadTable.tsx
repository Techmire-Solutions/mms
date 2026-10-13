import React from "react";
import { TableCellLink } from "@/components/app/TableCellLink";
import { ModuleTableHeaderCell } from "@/components/app/ModuleTableHeaderCell";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { ProgressBar } from "@/components/app/ProgressBar";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import { ReportDataGridContainer } from "@/components/reports/ReportDataGridContainer";
import type { FacultyWorkloadItem } from "@/components/reports/facultyReportTypes";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { ExportColumn } from "@/components/app/ExportToolbar";

interface FacultyReportWorkloadTableProps {
  t: TranslationFunction;
  rows: FacultyWorkloadItem[];
  selectedFaculty: string | null;
  onToggleFacultyFilter: (faculty: string) => void;
}

export const FacultyReportWorkloadTable = function FacultyReportWorkloadTable({
  t,
  rows,
  selectedFaculty,
  onToggleFacultyFilter,
}: FacultyReportWorkloadTableProps): React.JSX.Element {
  const maxClasses = Math.max(...rows.map((row) => row.classes), 1);
  const columns: ExportColumn[] = [
    { key: "faculty", header: t("faculty.report.colFaculty") },
    { key: "classes", header: t("faculty.report.colClasses") },
    { key: "sessions", header: t("faculty.report.colSessions") },
    { key: "students", header: t("faculty.report.colStudents") },
  ];
  const exportRows = rows.map((row) => ({
    faculty: row.faculty,
    classes: row.classes,
    sessions: row.sessions,
    students: row.totalStudents,
  }));

  return (
    <ReportDataGridContainer
      title={t("faculty.report.workloadReportTitle")}
      columns={columns}
      rows={exportRows}
      moduleId="faculty"
    >
      <div className="space-y-3 p-3 md:hidden">
        {rows.map((faculty) => (
          <article
            key={faculty.faculty}
            className={`${WORK_SURFACE_INNER} space-y-3 p-3 ${selectedFaculty === faculty.faculty ? "ring-1 ring-primary/20" : ""}`}
          >
            <TableCellLink
              tap
              toggle
              selected={selectedFaculty === faculty.faculty}
              onClick={() => onToggleFacultyFilter(faculty.faculty)}
            >
              {faculty.faculty}
            </TableCellLink>
            <StatGrid>
              <StatRow
                className="min-w-0"
                label={t("faculty.report.colClasses")}
                value={
                  <ProgressBar
                    value={(faculty.classes / maxClasses) * 100}
                    fillClassName="bg-primary"
                    trackClassName="w-16 flex-none"
                    label={faculty.classes}
                    labelClassName="text-foreground"
                  />
                }
              />
              <StatRow
                className="min-w-0"
                label={t("faculty.report.colSessions")}
                value={faculty.sessions}
              />
              <StatRow
                className="min-w-0"
                label={t("faculty.report.colStudents")}
                value={faculty.totalStudents}
                ddClassName="font-semibold"
              />
            </StatGrid>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{t("faculty.report.workloadReportTitle")}</caption>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
              {[
                { key: "faculty", label: t("faculty.report.colFaculty"), variant: "text" as const },
                { key: "classes", label: t("faculty.report.colClasses"), variant: "text" as const },
                {
                  key: "sessions",
                  label: t("faculty.report.colSessions"),
                  variant: "number" as const,
                },
                {
                  key: "students",
                  label: t("faculty.report.colStudents"),
                  variant: "number" as const,
                },
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
            {rows.map((faculty) => (
              <TableRow
                key={faculty.faculty}
                className={`hover:bg-muted/20 transition-colors ${selectedFaculty === faculty.faculty ? "bg-primary/10" : ""}`}
              >
                <TableCell className="px-3 py-2.5 font-medium">
                  <TableCellLink
                    toggle
                    selected={selectedFaculty === faculty.faculty}
                    onClick={() => onToggleFacultyFilter(faculty.faculty)}
                    className="font-medium"
                  >
                    {faculty.faculty}
                  </TableCellLink>
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <ProgressBar
                    value={(faculty.classes / maxClasses) * 100}
                    fillClassName="bg-primary"
                    trackClassName="w-16 flex-none"
                    label={faculty.classes}
                    labelClassName="text-foreground"
                  />
                </TableCell>
                <TableCell variant="number" noWrap className="px-3 py-2.5 text-muted-foreground">
                  {faculty.sessions}
                </TableCell>
                <TableCell
                  variant="number"
                  noWrap
                  className="px-3 py-2.5 font-semibold text-foreground"
                >
                  {faculty.totalStudents}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportDataGridContainer>
  );
};
