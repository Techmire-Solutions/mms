import React, { useState } from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { ReportDataGridContainer } from "@/components/reports/ReportDataGridContainer";
import { ModuleTableHeaderCell } from "@/components/app/ModuleTableHeaderCell";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import { useTranslation } from "@/hooks/useTranslation";
import type {
  AttendanceSummaryItem,
  RateBarRenderer,
  StudentAttendanceItem,
} from "./attendanceReportTypes";
import type { ExportColumn } from "@/components/app/ExportToolbar";
import { AttendanceSummaryTable } from "./AttendanceSummaryTable";

interface AttendanceReportTablesProps {
  summary: AttendanceSummaryItem[];
  studentAttendanceRows: StudentAttendanceItem[];
  rateBar: RateBarRenderer;
  onToggleClassFilter: (className: string) => void;
}

export function AttendanceReportTables({
  summary,
  studentAttendanceRows,
  rateBar,
  onToggleClassFilter,
}: AttendanceReportTablesProps): React.JSX.Element {
  const { t } = useTranslation();

  const studentColumns = [
    { key: "studentName", header: t("attendance.report.colStudent") },
    { key: "class", header: t("attendance.report.colStudentClass") },
    { key: "present", header: t("attendance.report.colPresent") },
    { key: "absent", header: t("attendance.report.colAbsent") },
    { key: "late", header: t("attendance.report.colLate") },
    { key: "total", header: t("attendance.report.colTotal") },
    { key: "rate", header: t("attendance.report.colRate") },
  ] as ExportColumn[];

  const studentRows = studentAttendanceRows.map((studentAttendance) => ({
    studentName: studentAttendance.studentName,
    class: studentAttendance.class,
    present: studentAttendance.present,
    absent: studentAttendance.absent,
    late: studentAttendance.late,
    total: studentAttendance.total,
    rate: `${studentAttendance.rate}%`,
  }));

  const [studentPage, setStudentPage] = useState(1);
  const studentPageSize = 15;
  const pagedStudentAttendanceRows = studentAttendanceRows.slice(
    (studentPage - 1) * studentPageSize,
    studentPage * studentPageSize,
  );

  return (
    <div className="space-y-6">
      <AttendanceSummaryTable
        summary={summary}
        rateBar={rateBar}
        onToggleClassFilter={onToggleClassFilter}
      />

      {studentAttendanceRows.length === 0 ? (
        <EmptyState icon={Users} title={t("attendance.report.noStudentRecords")} compact />
      ) : (
        <ReportDataGridContainer
          title={t("attendance.report.studentDetailTitle")}
          columns={studentColumns}
          rows={studentRows}
          moduleId="attendance"
          page={studentPage}
          total={studentAttendanceRows.length}
          limit={studentPageSize}
          onPageChange={setStudentPage}
          paginationVariant="range"
          i18nNamespace="attendance"
        >
          <div className="space-y-3 p-3 md:hidden">
            {pagedStudentAttendanceRows.map((studentAttendance) => (
              <article
                key={studentAttendance.studentName}
                className={`${WORK_SURFACE_INNER} space-y-3 p-3`}
              >
                <h4 className="truncate text-sm font-semibold text-foreground">
                  {studentAttendance.studentName}
                </h4>
                <StatGrid>
                  <StatRow
                    className="min-w-0"
                    label={t("attendance.report.colStudentClass")}
                    value={studentAttendance.class}
                  />
                  <StatRow
                    className="min-w-0"
                    label={t("attendance.report.colPresent")}
                    value={studentAttendance.present}
                    ddClassName="text-success font-medium"
                  />
                  <StatRow
                    className="min-w-0"
                    label={t("attendance.report.colAbsent")}
                    value={studentAttendance.absent}
                    ddClassName="text-destructive font-medium"
                  />
                  <StatRow
                    className="min-w-0"
                    label={t("attendance.report.colLate")}
                    value={studentAttendance.late}
                    ddClassName="text-warning font-medium"
                  />
                  <StatRow
                    className="min-w-0"
                    label={t("attendance.report.colTotal")}
                    value={studentAttendance.total}
                  />
                  <StatRow
                    className="min-w-0"
                    label={t("attendance.report.colRate")}
                    value={rateBar(studentAttendance.rate)}
                  />
                </StatGrid>
              </article>
            ))}
          </div>
          <div className="hidden md:block">
            <Table>
              <caption className="sr-only">{t("attendance.report.studentDetailTitle")}</caption>
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                  {[
                    { key: "student", label: t("attendance.report.colStudent") },
                    { key: "class", label: t("attendance.report.colStudentClass") },
                    { key: "present", label: t("attendance.report.colPresent") },
                    { key: "absent", label: t("attendance.report.colAbsent") },
                    { key: "late", label: t("attendance.report.colLate") },
                    { key: "total", label: t("attendance.report.colTotal") },
                    { key: "rate", label: t("attendance.report.colRate") },
                  ].map((header) => (
                    <ModuleTableHeaderCell
                      key={header.key}
                      columnKey={header.key}
                      className="px-3 py-2.5"
                    >
                      {header.label}
                    </ModuleTableHeaderCell>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-border/50">
                {pagedStudentAttendanceRows.map((studentAttendance) => (
                  <TableRow
                    key={studentAttendance.studentName}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <TableCell className="px-3 py-2.5 font-medium text-foreground">
                      {studentAttendance.studentName}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-muted-foreground">
                      {studentAttendance.class}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-success font-medium">
                      {studentAttendance.present}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-destructive font-medium">
                      {studentAttendance.absent}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-warning font-medium">
                      {studentAttendance.late}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-muted-foreground">
                      {studentAttendance.total}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 w-32">
                      {rateBar(studentAttendance.rate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ReportDataGridContainer>
      )}
    </div>
  );
}
