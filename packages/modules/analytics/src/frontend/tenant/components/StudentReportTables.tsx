import React from "react";
import { StatusBadge } from "@mms/fe-core/components/StatusBadge";
import { ModuleTableHeaderCell } from "@mms/fe-core/components/ModuleTableHeaderCell";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@mms/ui";
import { WORK_SURFACE_INNER } from "@mms/ui";
import { StatGrid, StatRow } from "@mms/ui/app/StatGrid";
import { useTranslation } from "@mms/fe-core/i18n";
import { toTitleCase } from "@mms/contracts";
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
          {students.map((student: any) => (
            <article
              key={student.id as any}
              className={`${WORK_SURFACE_INNER as any} space-y-3 p-3`}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <h4 className="truncate text-sm font-semibold text-foreground">
                  {student.name as any}
                </h4>
                <StatusBadge status={student.status as any} config={statusBadgeConfig as any} />
              </div>
              <StatGrid>
                <StatRow
                  className="min-w-0"
                  label={t("students.report.colGender")}
                  value={String(toTitleCase(student.gender))}
                />
                <StatRow
                  className="min-w-0"
                  label={t("students.report.colClass")}
                  value={student.class as any}
                  ddClassName="truncate"
                />
                <StatRow
                  className="min-w-0"
                  label={t("students.report.colSession")}
                  value={student.session as any}
                  ddClassName="truncate"
                />
                <StatRow
                  className="min-w-0"
                  label={t("students.report.colCity")}
                  value={student.city as any}
                  ddClassName="truncate"
                />
                <StatRow
                  className="min-w-0"
                  label={t("students.report.colAge")}
                  value={student.age as any}
                />
                <StatRow
                  className="min-w-0"
                  label={t("students.report.colRegistered")}
                  value={student.registered as any}
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
              {students.map((student: any) => (
                <TableRow key={student.id as any} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="px-3 py-2.5 font-medium text-foreground">
                    {student.name as any}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                    {String(toTitleCase(student.gender))}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                    {student.class as any}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground max-w-cell-sm truncate hidden md:table-cell">
                    {student.session as any}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">
                    {student.city as any}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                    {student.age as any}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">
                    {student.registered as any}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <StatusBadge status={student.status as any} config={statusBadgeConfig as any} />
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
        {enrollments.map((enrollment: any) => (
          <article
            key={enrollment.id as any}
            className={`${WORK_SURFACE_INNER as any} space-y-3 p-3`}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <h4 className="truncate text-sm font-semibold text-foreground">
                {enrollment.studentName as any}
              </h4>
              <StatusBadge
                status={enrollment.status as any}
                config={enrollmentStatusConfig as any}
              />
            </div>
            <StatGrid>
              <StatRow
                className="min-w-0"
                label={t("students.report.colSession")}
                value={enrollment.session as any}
              />
              <StatRow
                className="min-w-0"
                label={t("students.report.colClass")}
                value={enrollment.class as any}
              />
              <StatRow
                fullWidth
                label={t("students.report.colEnrolled")}
                value={enrollment.enrolled as any}
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
            {enrollments.map((enrollment: any) => (
              <TableRow key={enrollment.id as any} className="hover:bg-muted/20 transition-colors">
                <TableCell className="px-3 py-2.5 font-medium text-foreground">
                  {enrollment.studentName as any}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  {enrollment.session as any}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  {enrollment.class as any}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  {enrollment.enrolled as any}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <StatusBadge
                    status={enrollment.status as any}
                    config={enrollmentStatusConfig as any}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
};
