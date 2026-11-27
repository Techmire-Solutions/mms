import React from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@mms/ui";
import { StatusBadge } from "@mms/fe-core/components/StatusBadge";
import { ModuleTableHeaderCell } from "@mms/fe-core/components/ModuleTableHeaderCell";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@mms/ui";
import { WORK_SURFACE_INNER } from "@mms/ui";
import { StatGrid, StatRow } from "@mms/ui/app/StatGrid";
import { useTranslation } from "@mms/fe-core/i18n";
import { toTitleCase } from "@mms/contracts";
import { FacultyReportWorkloadTable } from "./FacultyReportWorkloadTable";
import { ReportDataGridContainer } from "./ReportDataGridContainer";
import type { ExportColumn } from "@mms/fe-core/components/ExportToolbar";

import type { FacultyReportTablesProps } from "./facultyReportTypes";

export const FacultyReportTables = function FacultyReportTables({
  activeSubTab,
  faculty,
  statusBadgeConfig,
  listLoading,
  workloadRows,
  selectedFaculty,
  onToggleFacultyFilter,
}: FacultyReportTablesProps): React.JSX.Element {
  const { t } = useTranslation();

  if (activeSubTab === "workload") {
    if (workloadRows.length === 0) {
      return (
        <EmptyState
          icon={Users as any}
          title={t("faculty.report.noFacultyData")}
          description={t("faculty.report.adjustFilters")}
          compact
        />
      );
    }
    return (
      <FacultyReportWorkloadTable
        t={t as any}
        rows={workloadRows as any}
        selectedFaculty={selectedFaculty as any}
        onToggleFacultyFilter={onToggleFacultyFilter as any}
      />
    );
  }

  const rosterColumns: ExportColumn[] = [
    { key: "name", header: t("faculty.report.colName") },
    { key: "employeeId", header: t("faculty.report.colEmployeeId") },
    { key: "specialization", header: t("faculty.report.colSpecialization") },
    { key: "qualification", header: t("faculty.report.colQualification") },
    { key: "gender", header: t("faculty.report.colGender") },
    { key: "joinDate", header: t("faculty.report.colJoinDate") },
    { key: "status", header: t("faculty.report.colStatus") },
  ];
  const rosterRows = faculty.map((member: any) => ({
    name: member.name,
    employeeId: member.employeeId,
    specialization: member.specialization,
    qualification: member.qualification,
    gender: String(toTitleCase(member.gender)),
    joinDate: member.joinDate,
    status: member.status,
  }));

  return (
    <ReportDataGridContainer
      title={t("faculty.report.rosterTab")}
      columns={rosterColumns as any}
      rows={rosterRows as any}
      moduleId="faculty"
      isLoading={listLoading as any}
      empty={!listLoading && faculty.length === 0}
      emptyTitle={t("faculty.report.noFacultyFound")}
      emptyDescription={t("faculty.report.adjustFilters")}
      emptyIcon={Users as any}
    >
      <div className="space-y-3 p-3 md:hidden">
        {faculty.map((member: any) => (
          <article key={member.id as any} className={`${WORK_SURFACE_INNER as any} space-y-3 p-3`}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <h4 className="truncate text-sm font-semibold text-foreground">
                {member.name as any}
              </h4>
              <StatusBadge status={member.status as any} config={statusBadgeConfig as any} />
            </div>
            <StatGrid>
              <StatRow
                className="min-w-0"
                label={t("faculty.report.colEmployeeId")}
                value={member.employeeId as any}
              />
              <StatRow
                className="min-w-0"
                label={t("faculty.report.colSpecialization")}
                value={member.specialization as any}
                ddClassName="truncate"
              />
              <StatRow
                className="min-w-0"
                label={t("faculty.report.colQualification")}
                value={member.qualification as any}
                ddClassName="truncate"
              />
              <StatRow
                className="min-w-0"
                label={t("faculty.report.colGender")}
                value={String(toTitleCase(member.gender))}
                ddClassName="truncate"
              />
              <StatRow
                className="min-w-0"
                label={t("faculty.report.colJoinDate")}
                value={member.joinDate as any}
                ddClassName="text-muted-foreground"
              />
            </StatGrid>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{t("faculty.report.rosterTab")}</caption>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
              <ModuleTableHeaderCell columnKey="name" className="px-3 py-2.5">
                {t("faculty.report.colName")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell
                columnKey="employeeId"
                className="px-3 py-2.5 hidden sm:table-cell"
              >
                {t("faculty.report.colEmployeeId")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell
                columnKey="specialization"
                className="px-3 py-2.5 hidden sm:table-cell"
              >
                {t("faculty.report.colSpecialization")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell
                columnKey="qualification"
                className="px-3 py-2.5 hidden md:table-cell"
              >
                {t("faculty.report.colQualification")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell
                columnKey="gender"
                className="px-3 py-2.5 hidden lg:table-cell"
              >
                {t("faculty.report.colGender")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell
                columnKey="joinDate"
                className="px-3 py-2.5 hidden lg:table-cell"
              >
                {t("faculty.report.colJoinDate")}
              </ModuleTableHeaderCell>
              <ModuleTableHeaderCell columnKey="status" className="px-3 py-2.5">
                {t("faculty.report.colStatus")}
              </ModuleTableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/50">
            {faculty.map((member: any) => (
              <TableRow key={member.id as any} className="hover:bg-muted/20 transition-colors">
                <TableCell className="px-3 py-2.5 font-medium text-foreground">
                  {member.name as any}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                  {member.employeeId as any}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                  {member.specialization as any}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground max-w-cell-lg truncate hidden md:table-cell">
                  {member.qualification as any}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">
                  {String(toTitleCase(member.gender))}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">
                  {member.joinDate as any}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <StatusBadge status={member.status as any} config={statusBadgeConfig as any} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportDataGridContainer>
  );
};
