import React from "react";
import { BookOpen, Star, Trophy, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportToolbar } from "@/components/ui/ExportToolbar";
import { ModuleCommandMetricsGrid } from "@/components/ui/ModuleCommandMetricsGrid";
import { ActiveFilterBanner } from "@/components/ui/ActiveFilterBanner";
import { useTranslation } from "@/hooks/useTranslation";
import type { AcademicResultItem } from "./academicReportTypes";
import { AcademicReportResultsBody } from "./AcademicReportResultsBody";

interface AcademicReportKpisProps {
  totalRecords: number;
  averageMarks: string | number;
  topScore: number;
  passRate: string | number;
}

export const AcademicReportKpis = React.memo(function AcademicReportKpis({
  totalRecords,
  averageMarks,
  topScore,
  passRate,
}: AcademicReportKpisProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleCommandMetricsGrid
      items={[
        {
          icon: BookOpen,
          label: t("examinations.report.totalRecords"),
          value: totalRecords,
          accent: "primary",
        },
        {
          icon: TrendingUp,
          label: t("examinations.report.classAvg"),
          value: `${averageMarks}%`,
          accent: "blue",
        },
        {
          icon: Trophy,
          label: t("examinations.report.topScore"),
          value: `${topScore}%`,
          accent: "amber",
        },
        {
          icon: Star,
          label: t("examinations.report.passRate"),
          value: `${passRate}%`,
          accent: "green",
        },
      ]}
    />
  );
});

interface AcademicReportFilterBannerProps {
  selectedStudent: string | null;
  selectedClass: string | null;
  onClearStudent: () => void;
  onClearClass: () => void;
}

export const AcademicReportFilterBanner = React.memo(function AcademicReportFilterBanner({
  selectedStudent,
  selectedClass,
  onClearStudent,
  onClearClass,
}: AcademicReportFilterBannerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!selectedStudent && !selectedClass) return null;

  return (
    <ActiveFilterBanner
      chips={[
        ...(selectedStudent
          ? [
              {
                key: "student",
                label: t("examinations.report.studentFilterLabel"),
                value: selectedStudent,
              },
            ]
          : []),
        ...(selectedClass
          ? [
              {
                key: "class",
                label: t("examinations.report.classFilterLabel"),
                value: selectedClass,
              },
            ]
          : []),
      ]}
      actions={[
        ...(selectedStudent
          ? [
              {
                key: "student",
                label: t("examinations.report.clearStudentFilter"),
                onClick: onClearStudent,
              },
            ]
          : []),
        ...(selectedClass
          ? [
              {
                key: "class",
                label: t("examinations.report.clearClassFilter"),
                onClick: onClearClass,
              },
            ]
          : []),
      ]}
    />
  );
});

interface AcademicReportResultsTableProps {
  academicResults: AcademicResultItem[];
  onToggleStudentFilter: (studentName: string) => void;
}

export const AcademicReportResultsTable = React.memo(function AcademicReportResultsTable({
  academicResults,
  onToggleStudentFilter,
}: AcademicReportResultsTableProps): React.JSX.Element {
  const { t } = useTranslation();
  const headers = React.useMemo(
    () => [
      t("examinations.report.colRank"),
      t("examinations.report.colStudent"),
      t("examinations.report.colClass"),
      t("examinations.report.colSubject"),
      t("examinations.report.colMarks"),
      t("examinations.report.colGrade"),
    ],
    [t],
  );

  return (
    <>
      <ExportToolbar
        title={t("examinations.report.examResultsTitle")}
        data={academicResults}
        headers={headers}
      />
      {academicResults.length === 0 ? (
        <EmptyState icon={BookOpen} title={t("examinations.report.noResultsFound")} compact />
      ) : (
        <AcademicReportResultsBody
          academicResults={academicResults}
          onToggleStudentFilter={onToggleStudentFilter}
        />
      )}
    </>
  );
});
