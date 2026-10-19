import React, { useState } from "react";
import { Trophy } from "lucide-react";
import { StatusBadge } from "@/components/app/StatusBadge";
import { TableCellLink } from "@shared/ui";
import { ModuleTableHeaderCell } from "@/components/app/ModuleTableHeaderCell";
import { ReportDataGridContainer } from "@/components/reports/ReportDataGridContainer";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import type { AcademicResultItem } from "./academicReportTypes";

const GRADE_BADGE_CLS: Record<string, string> = {
  "A+": SEMANTIC_BADGE.successStrong,
  A: SEMANTIC_BADGE.success,
  "B+": SEMANTIC_BADGE.info,
  B: SEMANTIC_BADGE.info,
  C: SEMANTIC_BADGE.warning,
  F: SEMANTIC_BADGE.destructive,
};
import type { ExportColumn } from "@/components/app/ExportToolbar";

interface AcademicReportResultsBodyProps {
  academicResults: AcademicResultItem[];
  onToggleStudentFilter: (studentName: string) => void;
}

export const AcademicReportResultsBody = function AcademicReportResultsBody({
  academicResults,
  onToggleStudentFilter,
}: AcademicReportResultsBodyProps): React.JSX.Element {
  const { t } = useTranslation();
  const headers = (() => [
    { key: "rank", label: t("examinations.report.colRank"), variant: "badge" as const },
    { key: "student", label: t("examinations.report.colStudent"), variant: "text" as const },
    { key: "class", label: t("examinations.report.colClass"), variant: "text" as const },
    { key: "subject", label: t("examinations.report.colSubject"), variant: "text" as const },
    { key: "marks", label: t("examinations.report.colMarks"), variant: "number" as const },
    { key: "grade", label: t("examinations.report.colGrade"), variant: "badge" as const },
  ])();

  const exportColumns = (() => [
    { key: "rank", header: t("examinations.report.colRank") },
    { key: "student", header: t("examinations.report.colStudent") },
    { key: "class", header: t("examinations.report.colClass") },
    { key: "subject", header: t("examinations.report.colSubject") },
    { key: "marks", header: t("examinations.report.colMarks") },
    { key: "grade", header: t("examinations.report.colGrade") },
  ])() as ExportColumn[];

  const exportRows = (() =>
    academicResults.map((result) => ({
      rank: result.rank,
      student: result.studentName,
      class: result.class,
      subject: result.subject,
      marks: `${result.marks}/${result.total}`,
      grade: result.grade,
    })))();

  const [page, setPage] = useState(1);
  const pageSize = 15;
  const pagedAcademicResults = (() =>
    academicResults.slice((page - 1) * pageSize, page * pageSize))();

  return (
    <ReportDataGridContainer
      title={t("examinations.report.examResultsTitle")}
      columns={exportColumns}
      rows={exportRows}
      moduleId="examinations"
      page={page}
      total={academicResults.length}
      limit={pageSize}
      onPageChange={setPage}
      paginationVariant="range"
      i18nNamespace="examinations"
      empty={academicResults.length === 0}
      emptyTitle={t("examinations.report.noResultsFound")}
    >
      <div className="space-y-3 p-3 md:hidden">
        {pagedAcademicResults.map((academicResult) => (
          <article
            key={`${academicResult.studentName}-${academicResult.class}`}
            className={`${WORK_SURFACE_INNER} space-y-3 p-3`}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {academicResult.rank === 1 ? (
                  <Trophy className="h-4 w-4 shrink-0 text-warning" />
                ) : (
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    #{academicResult.rank}
                  </span>
                )}
                <TableCellLink
                  tap
                  onClick={() => onToggleStudentFilter(academicResult.studentName)}
                  className="truncate"
                >
                  {academicResult.studentName}
                </TableCellLink>
              </div>
              <StatusBadge
                status={academicResult.grade}
                size="sm"
                config={{
                  [academicResult.grade]: {
                    label: academicResult.grade,
                    cls: GRADE_BADGE_CLS[academicResult.grade] ?? SEMANTIC_BADGE.muted,
                  },
                }}
              />
            </div>
            <StatGrid>
              <StatRow
                className="min-w-0"
                label={t("examinations.report.colClass")}
                value={academicResult.class}
              />
              <StatRow
                className="min-w-0"
                label={t("examinations.report.colSubject")}
                value={academicResult.subject}
              />
              <StatRow
                fullWidth
                label={t("examinations.report.colMarks")}
                value={`${academicResult.marks}/${academicResult.total}`}
                ddClassName="font-semibold"
              />
            </StatGrid>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{t("examinations.report.examResultsTitle")}</caption>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
              {headers.map((header) => (
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
            {pagedAcademicResults.map((academicResult) => (
              <TableRow
                key={`${academicResult.studentName}-${academicResult.class}`}
                className="hover:bg-muted/20 transition-colors"
              >
                <TableCell variant="badge" noWrap className="px-3 py-2.5">
                  {academicResult.rank === 1 ? (
                    <Trophy className="w-4 h-4 text-warning inline-block" />
                  ) : (
                    <span className="text-muted-foreground">{academicResult.rank}</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-2.5 font-medium">
                  {academicResult.studentName}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  {academicResult.class}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  {academicResult.subject}
                </TableCell>
                <TableCell variant="number" noWrap className="px-3 py-2.5 font-semibold">
                  {academicResult.marks}/{academicResult.total}
                </TableCell>
                <TableCell variant="badge" noWrap className="px-3 py-2.5">
                  <StatusBadge
                    status={academicResult.grade}
                    size="sm"
                    config={{
                      [academicResult.grade]: {
                        label: academicResult.grade,
                        cls: GRADE_BADGE_CLS[academicResult.grade] ?? SEMANTIC_BADGE.muted,
                      },
                    }}
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

export { GRADE_BADGE_CLS, AcademicReportResultsBody as AcademicReportResultsTable };
