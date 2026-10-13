import React, { lazy, Suspense } from "react";
import { FACULTY_MODULE_MANIFEST, toTitleCase } from "@mms/shared";
import { SubTabBar } from "@/components/ui/SubTabBar";
import { ReportDataGridContainer } from "./ReportDataGridContainer";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportFilterBanner } from "./ReportFilterBanner";
import { FacultyReportTables } from "./FacultyReportTables";
import type { FacultyReportViewModel } from "./reportViewModels";

const FacultyReportChartSection = lazy(() =>
  import("./FacultyReportSections").then((mod) => ({ default: mod.FacultyReportChartSection })),
);

export function FacultyReportView({
  report,
  widgets,
}: {
  report: FacultyReportViewModel;
  widgets?: React.ReactNode;
}): React.JSX.Element {
  if (report.activeSubTab === "roster" && report.listError) {
    return (
      <div className="p-4">
        <ErrorState
          title={report.t("faculty.report.loadFailed")}
          description={report.t("faculty.report.loadFailedHint")}
          onRetry={() => {
            void report.listRefetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ReportFilterBanner
        label={report.t("faculty.report.filterLabel")}
        filters={[
          report.reportStatusFilter
            ? {
                key: "status",
                value: toTitleCase(report.reportStatusFilter),
                onClear: () => report.setReportStatusFilter(null),
                clearLabel: report.t("faculty.report.clearFilter"),
              }
            : null,
          report.filters.student
            ? {
                key: "faculty",
                value: `"${report.filters.student}"`,
              }
            : null,
        ]}
      />

      <SubTabBar
        tabs={report.REPORT_TABS}
        value={report.activeSubTab}
        onChange={report.setActiveSubTab}
        panelIdPrefix="faculty-report-subtab"
      />

      {report.activeSubTab === "roster" ? (
        <ReportDataGridContainer
          title={report.t("faculty.report.rosterTab")}
          columns={report.rosterExportColumns}
          rows={report.faculty}
          resolveRows={report.resolveRosterExportRows}
          moduleId="faculty"
          page={report.listPage}
          total={report.listTotal}
          limit={FACULTY_MODULE_MANIFEST.defaultPageSize}
          hasMore={report.listHasMore}
          onPageChange={report.setListPage}
          i18nNamespace="faculty"
          paginationVariant="range"
        >
          <FacultyReportTables
            activeSubTab={report.activeSubTab}
            faculty={report.faculty}
            statusBadgeConfig={report.statusBadgeConfig}
            listLoading={report.listLoading}
            workloadRows={report.filteredFacultyWorkload}
            selectedFaculty={report.selectedFaculty}
            onToggleFacultyFilter={report.toggleFacultyFilter}
          />
        </ReportDataGridContainer>
      ) : (
        <div className="space-y-3">
          <Suspense fallback={<Skeleton className="h-chart-md w-full rounded-xl" />}>
            <FacultyReportChartSection
              t={report.t}
              facultyWorkload={report.facultyWorkload}
              onBarClick={report.toggleFacultyFilter}
            />
          </Suspense>
          <ReportDataGridContainer
            title={report.t("faculty.report.workloadTab")}
            columns={report.workloadExportColumns}
            rows={report.filteredFacultyWorkload}
            moduleId="faculty"
          >
            <FacultyReportTables
              activeSubTab={report.activeSubTab}
              faculty={report.faculty}
              statusBadgeConfig={report.statusBadgeConfig}
              listLoading={report.listLoading}
              workloadRows={report.filteredFacultyWorkload}
              selectedFaculty={report.selectedFaculty}
              onToggleFacultyFilter={report.toggleFacultyFilter}
            />
          </ReportDataGridContainer>
        </div>
      )}

      {widgets}
    </div>
  );
}
