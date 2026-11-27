import React, { lazy, Suspense } from "react";
import { Skeleton } from "@mms/ui";
import { ErrorState } from "@mms/fe-core/components/ErrorState";
import { useAcademicReportController } from "../hooks/useAcademicReportController";

const AcademicReportCharts: React.ComponentType<any> = lazy(() =>
  import("../../components/AcademicReportCharts").then((mod: any) => ({
    default: mod.AcademicReportCharts,
  })),
);
import { AcademicReportClassRankings } from "../../components/AcademicReportClassRankings";
import { ReportFilterBanner } from "../../components/ReportFilterBanner";
import { AcademicReportResultsTable } from "../../components/AcademicReportResultsBody";
import PinnedWidgets from "./PinnedWidgets";

import type { AcademicReportProps } from "../../components/academicReportTypes";

export type {
  AcademicReportFilters,
  AcademicReportProps,
  AcademicResultItem,
  ClassRankingItem,
} from "../../components/academicReportTypes";

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
