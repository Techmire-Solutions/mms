import React from "react";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ModuleTableHeaderCell } from "@/components/app/ModuleTableHeaderCell";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import { useTranslation } from "@/hooks/useTranslation";
import { toTitleCase } from "@mms/shared";
import type { StudentReportTablesProps } from "./studentReportTypes";

export const StudentReportTables = function StudentReportTables({
  activeSubTab,
  students,
  enrollments,
  statusBadgeConfig,
  enrollmentStatusConfig,
}: StudentReportTablesProps): React.JSX.Element {
  const { t } = useTranslation();

  if (activeSubTab === "list") {
    return (
      <>
        <div className="space-y-3 p-3 md:hidden">
          {students.map((student) => (
            <article key={student.id} className={`${WORK_SURFACE_INNER} space-y-3 p-3`}>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <h4 className="truncate text-sm font-semibold text-foreground">{student.name}</h4>
                <StatusBadge status={student.status} config={statusBadgeConfig} />
              </div>
              <StatGrid>
                <StatRow
                  className="min-w-0"
                  label={t("students.report.colGender")}
                  value={toTitleCase(student.gender)}
                />
                <StatRow
                  className="min-w-0"
                  label={t("students.report.colClass")}
                  value={student.class}
                  ddClassName="truncate"
                />
                <StatRow
                  className="min-w-0"
                  label={t("students.report.colSession")}
                  value={student.session}
                  ddClassName="truncate"
                />
                <StatRow
                  className="min-w-0"
                  label={t("students.report.colCity")}
                  value={student.city}
                  ddClassName="truncate"
                />
                <StatRow
                  className="min-w-0"
                  label={t("students.report.colAge")}
                  value={student.age}
                />
                <StatRow
                  className="min-w-0"
                  label={t("students.report.colRegistered")}
                  value={student.registered}
                  ddClassName="text-muted-foreground"
                />
              </StatGrid>
            </article>
          ))}
        </div>
        <div className="hidden md:block">
          <Table>
            <caption className="sr-only">{t("students.report.studentListTab")}</caption>
            <TableHeader>
              <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                <ModuleTableHeaderCell columnKey="name" className="px-3 py-2.5">
                  {t("students.report.colName")}
                </ModuleTableHeaderCell>
                <ModuleTableHeaderCell
                  columnKey="gender"
                  className="px-3 py-2.5 hidden sm:table-cell"
                >
                  {t("students.report.colGender")}
                </ModuleTableHeaderCell>
                <ModuleTableHeaderCell
                  columnKey="class"
                  className="px-3 py-2.5 hidden sm:table-cell"
                >
                  {t("students.report.colClass")}
                </ModuleTableHeaderCell>
                <ModuleTableHeaderCell
                  columnKey="session"
                  className="px-3 py-2.5 hidden md:table-cell"
                >
                  {t("students.report.colSession")}
                </ModuleTableHeaderCell>
                <ModuleTableHeaderCell
                  columnKey="city"
                  className="px-3 py-2.5 hidden lg:table-cell"
                >
                  {t("students.report.colCity")}
                </ModuleTableHeaderCell>
                <ModuleTableHeaderCell columnKey="age" className="px-3 py-2.5 hidden md:table-cell">
                  {t("students.report.colAge")}
                </ModuleTableHeaderCell>
                <ModuleTableHeaderCell
                  columnKey="registered"
                  className="px-3 py-2.5 hidden lg:table-cell"
                >
                  {t("students.report.colRegistered")}
                </ModuleTableHeaderCell>
                <ModuleTableHeaderCell columnKey="status" className="px-3 py-2.5">
                  {t("students.report.colStatus")}
                </ModuleTableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/50">
              {students.map((student) => (
                <TableRow key={student.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="px-3 py-2.5 font-medium text-foreground">
                    {student.name}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                    {toTitleCase(student.gender)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                    {student.class}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground max-w-cell-sm truncate hidden md:table-cell">
                    {student.session}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">
                    {student.city}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                    {student.age}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">
                    {student.registered}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <StatusBadge status={student.status} config={statusBadgeConfig} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-3 p-3 md:hidden">
        {enrollments.map((enrollment) => (
          <article key={enrollment.id} className={`${WORK_SURFACE_INNER} space-y-3 p-3`}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <h4 className="truncate text-sm font-semibold text-foreground">
                {enrollment.studentName}
              </h4>
              <StatusBadge status={enrollment.status} config={enrollmentStatusConfig} />
            </div>
            <StatGrid>
              <StatRow
                className="min-w-0"
                label={t("students.report.colSession")}
                value={enrollment.session}
              />
              <StatRow
                className="min-w-0"
                label={t("students.report.colClass")}
                value={enrollment.class}
              />
              <StatRow
                fullWidth
                label={t("students.report.colEnrolled")}
                value={enrollment.enrolled}
                ddClassName="text-muted-foreground"
              />
            </StatGrid>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{t("students.report.enrollmentHistoryTab")}</caption>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
              <ModuleTableHeaderCell columnKey="student" className="px-4 py-3">
                {t("students.report.colStudent")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell columnKey="session" className="px-4 py-3">
                {t("students.report.colSession")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell columnKey="class" className="px-4 py-3">
                {t("students.report.colClass")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell columnKey="enrolled" className="px-4 py-3">
                {t("students.report.colEnrolled")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell columnKey="status" className="px-4 py-3">
                {t("students.report.colStatus")}
              </ModuleTableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/50">
            {enrollments.map((enrollment) => (
              <TableRow key={enrollment.id} className="hover:bg-muted/20 transition-colors">
                <TableCell className="px-3 py-2.5 font-medium text-foreground">
                  {enrollment.studentName}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  {enrollment.session}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  {enrollment.class}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  {enrollment.enrolled}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <StatusBadge status={enrollment.status} config={enrollmentStatusConfig} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
};
