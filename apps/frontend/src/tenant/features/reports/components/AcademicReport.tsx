import React, { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";
import { useAcademicReportController } from "../hooks/useAcademicReportController";

const AcademicReportCharts = lazy(() =>
  import("@/components/reports/AcademicReportCharts").then((mod) => ({
    default: mod.AcademicReportCharts,
  })),
);
import { AcademicReportClassRankings } from "@/components/reports/AcademicReportClassRankings";
import { ReportFilterBanner } from "@/components/reports/ReportFilterBanner";
import { AcademicReportResultsTable } from "@/components/reports/AcademicReportResultsBody";
import PinnedWidgets from "@/tenant/features/reports/components/PinnedWidgets";

import type { AcademicReportProps } from "@/components/reports/academicReportTypes";

export type {
  AcademicReportFilters,
  AcademicReportProps,
  AcademicResultItem,
  ClassRankingItem,
} from "@/components/reports/academicReportTypes";

/**
 * Renders the academic/exam reports including summary charts, class rankings cards, and a filterable exam-results table.
 */
const AcademicReport = function AcademicReport({
  filters,
}: AcademicReportProps): React.JSX.Element {
  const {
    t,
    examsQuery,
    resultsQuery,
    aggregatesQuery,
    selectedStudent,
    selectedClass,
    setSelectedStudent,
    setSelectedClass,
    filteredAcademicResultsData,
    filteredClassRankings,
    toggleClassFilter,
    toggleStudentFilter,
  } = useAcademicReportController({ filters });

  if (examsQuery.isError || resultsQuery.isError || aggregatesQuery.isError) {
    return (
      <div className="p-4">
        <ErrorState
          title={t("examinations.loadFailed")}
          description={t("examinations.loadFailedHint")}
          onRetry={() => {
            void examsQuery.refetch();
            void resultsQuery.refetch();
            void aggregatesQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Suspense fallback={<Skeleton className="h-chart-md w-full rounded-xl" />}>
        <AcademicReportCharts
          academicResults={filteredAcademicResultsData}
          classRankings={filteredClassRankings}
          onToggleStudentFilter={toggleStudentFilter}
          onToggleClassFilter={toggleClassFilter}
        />
      </Suspense>

      <ReportFilterBanner
        filters={[
          selectedStudent
            ? {
                key: "student",
                label: t("examinations.report.studentFilterLabel"),
                value: selectedStudent,
                onClear: () => setSelectedStudent(null),
                clearLabel: t("examinations.report.clearStudentFilter"),
              }
            : null,
          selectedClass
            ? {
                key: "class",
                label: t("examinations.report.classFilterLabel"),
                value: selectedClass,
                onClear: () => setSelectedClass(null),
                clearLabel: t("examinations.report.clearClassFilter"),
              }
            : null,
        ]}
      />
      <AcademicReportClassRankings
        classRankings={filteredClassRankings}
        onToggleClassFilter={toggleClassFilter}
      />
      <AcademicReportResultsTable
        academicResults={filteredAcademicResultsData}
        onToggleStudentFilter={toggleStudentFilter}
      />
      <PinnedWidgets category="examinations" />
    </div>
  );
};

export default AcademicReport;
