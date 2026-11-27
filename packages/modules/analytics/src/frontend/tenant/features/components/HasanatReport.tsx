import React, { lazy, Suspense, useState } from "react";
import type {
  HasanatFacultyBarItem,
  HasanatPieItem,
} from "../../components/hasanatReportSectionTypes";
import { useBrandPalette } from "../../host/useBrandPalette";
import { useHasanatStudentReport } from "../../host/collections";
import type { HasanatStudentReportRowDto } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { Skeleton } from "@mms/ui";
import { ErrorState } from "@mms/fe-core/components/ErrorState";
import { HasanatDistributionTable } from "../../components/HasanatDistributionTable";

const HasanatReportCharts: React.ComponentType<any> = lazy(() =>
  import("../../components/HasanatReportCharts").then((mod: any) => ({
    default: mod.HasanatReportCharts,
  })),
);
import { ReportFilterBanner } from "../../components/ReportFilterBanner";
import PinnedWidgets from "./PinnedWidgets";

import type {
  HasanatReportProps,
  HasanatReportItem,
  HasanatByFacultyItem,
} from "../../components/hasanatReportTypes";
export type { HasanatReportItem, HasanatByFacultyItem } from "../../components/hasanatReportTypes";

/**
 * Renders the Hasanat rewards and points distribution reports,
 * including faculty distribution bar charts, redemption pie charts,
 * and a filterable distribution table.
 */
const HasanatReport = function HasanatReport({ filters }: HasanatReportProps): React.JSX.Element {
  const { t } = useTranslation();
  const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);
  const palette = useBrandPalette();
  const PIE_COLORS = (() => [palette.primary, palette.secondary, palette.charts[2]])();
  // Server read model: one statement for every student, session/date scoped and tier-aware.
  const sessionId = filters.session && filters.session !== "all" ? filters.session : null;
  const reportQuery = useHasanatStudentReport({
    sessionId,
    from: filters.dateFrom || null,
    to: filters.dateTo || null,
  });
  const reportRows: HasanatStudentReportRowDto[] =
    reportQuery.data && reportQuery.data.status === 200 ? reportQuery.data.body.rows : [];

  const { distributionData, hasanatByFaculty } = (() => {
    const facultyMap: Record<string, HasanatByFacultyItem> = {};
    const items: HasanatReportItem[] = reportRows.map((row: any) => {
      const faculty = row.faculty || "—";
      if (!facultyMap[faculty]) {
        facultyMap[faculty] = { faculty, totalDistributed: 0, totalRedeemed: 0 };
      }
      facultyMap[faculty].totalDistributed += row.earned;
      facultyMap[faculty].totalRedeemed += row.redeemed;

      return {
        studentName: row.studentName,
        class: row.className,
        faculty,
        distributed: row.earned,
        redeemed: row.redeemed,
        balance: row.balance,
        tierName: row.tierName,
        tierKey: row.tierKey,
        percentToNext: row.percentToNext,
      };
    });

    return {
      distributionData: items,
      hasanatByFaculty: Object.values(facultyMap),
    };
  })();

  const distribution = (() => {
    let filteredDistribution = distributionData;
    if (filters.class !== "all") {
      filteredDistribution = filteredDistribution.filter(
        (hasanatItem: any) => hasanatItem.class === filters.class,
      );
    }
    if (filters.student) {
      filteredDistribution = filteredDistribution.filter((hasanatItem: any) =>
        hasanatItem.studentName.toLowerCase().includes(filters.student.toLowerCase()),
      );
    }
    if (selectedFaculty) {
      filteredDistribution = filteredDistribution.filter(
        (hasanatItem: any) => hasanatItem.faculty === selectedFaculty,
      );
    }
    return filteredDistribution;
  })() as HasanatReportItem[];

  const totalRedeemed = distribution.reduce(
    (total: any, hasanatItem: any) => total + hasanatItem.redeemed,
    0,
  );
  const totalBalance = distribution.reduce(
    (total: any, hasanatItem: any) => total + hasanatItem.balance,
    0,
  );

  const facultyChartData = (() => {
    return hasanatByFaculty.map((facultyTotals: any) => ({
      faculty: facultyTotals.faculty,
      distributed: facultyTotals.totalDistributed,
      redeemed: facultyTotals.totalRedeemed,
    }));
  })() as HasanatFacultyBarItem[];

  const toggleFacultyFilter = (faculty: string) => {
    setSelectedFaculty((current: any) => (current === faculty ? null : faculty));
  };

  const redemptionPieData = (() => [
    { name: t("hasanat.report.redeemedPieLabel"), value: totalRedeemed },
    { name: t("hasanat.report.balancePieLabel"), value: totalBalance },
  ])() as HasanatPieItem[];

  if (reportQuery.isError) {
    return (
      <div className="p-4">
        <ErrorState
          title={t("hasanat.loadFailed")}
          description={t("hasanat.loadFailedHint")}
          onRetry={() => {
            void reportQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Suspense fallback={<Skeleton className="h-chart-md w-full rounded-xl" />}>
        <HasanatReportCharts
          facultyChartData={facultyChartData}
          redemptionPieData={redemptionPieData}
          pieColors={PIE_COLORS}
          onToggleFacultyFilter={toggleFacultyFilter}
        />
      </Suspense>
      <ReportFilterBanner
        filters={[
          selectedFaculty
            ? {
                key: "faculty",
                label: t("hasanat.report.facultyFilterLabel"),
                value: selectedFaculty,
                onClear: () => setSelectedFaculty(null),
                clearLabel: t("hasanat.report.clearFacultyFilter"),
              }
            : null,
        ]}
      />
      <HasanatDistributionTable
        distribution={distribution}
        selectedFaculty={selectedFaculty}
        onToggleFacultyFilter={toggleFacultyFilter}
      />
      <PinnedWidgets category="hasanat" />
    </div>
  );
};

export default HasanatReport;
