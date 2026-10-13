import React, { lazy, Suspense, useState } from "react";
import type {
  HasanatFacultyBarItem,
  HasanatPieItem,
} from "@/components/reports/hasanatReportSectionTypes";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import {
  useHasanatDistributions,
  useHasanatDistributionsCollection,
  useHasanatDenoms,
  useHasanatDenomsCollection,
  useHasanatReportAggregates,
} from "@/tenant/hooks/collections/hasanat";
import { useTranslation } from "@/hooks/useTranslation";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/app/ErrorState";
import { getDenominationPoints } from "@mms/shared";
import { HasanatDistributionTable } from "@/components/reports/HasanatDistributionTable";

const HasanatReportCharts = lazy(() =>
  import("@/components/reports/HasanatReportCharts").then((mod) => ({
    default: mod.HasanatReportCharts,
  })),
);
import { ReportFilterBanner } from "@/components/reports/ReportFilterBanner";
import PinnedWidgets from "@/tenant/features/reports/components/PinnedWidgets";

import type {
  HasanatReportProps,
  HasanatReportItem,
  HasanatByFacultyItem,
} from "@/components/reports/hasanatReportTypes";
export type {
  HasanatReportItem,
  HasanatByFacultyItem,
} from "@/components/reports/hasanatReportTypes";

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
  const distQuery = useHasanatDistributions();
  const denomsQuery = useHasanatDenoms();
  const aggregatesQuery = useHasanatReportAggregates();

  const distributions = useHasanatDistributionsCollection();
  const denominations = useHasanatDenomsCollection();

  const { distributionData, hasanatByFaculty } = (() => {
    const studentMap: Record<string, HasanatReportItem> = {};
    const facultyMap: Record<string, HasanatByFacultyItem> = {};

    distributions.forEach((distributionRecord) => {
      const points = getDenominationPoints(
        distributionRecord.denominationId,
        distributionRecord.denominationName,
        denominations,
      );

      const totalPoints = points * distributionRecord.quantity;
      const isRedeemed = distributionRecord.status === "redeemed";

      if (distributionRecord.recipientType === "student") {
        const studentKey =
          distributionRecord.recipientStudentId || distributionRecord.recipientName || "";
        if (studentKey) {
          const studentName = distributionRecord.recipientName || studentKey;
          if (!studentMap[studentKey]) {
            studentMap[studentKey] = {
              studentName,
              class: distributionRecord.recipientClass,
              faculty: distributionRecord.issuedBy || "—",
              distributed: 0,
              redeemed: 0,
              balance: 0,
            };
          }
          studentMap[studentKey].distributed += totalPoints;
          if (isRedeemed) studentMap[studentKey].redeemed += totalPoints;
          else studentMap[studentKey].balance += totalPoints;
        }
      }

      const facultyKey = distributionRecord.issuedBy || "—";
      if (!facultyMap[facultyKey]) {
        facultyMap[facultyKey] = {
          faculty: facultyKey,
          totalDistributed: 0,
          totalRedeemed: 0,
        };
      }
      facultyMap[facultyKey].totalDistributed += totalPoints;
      if (isRedeemed) facultyMap[facultyKey].totalRedeemed += totalPoints;
    });

    return {
      distributionData: Object.values(studentMap),
      hasanatByFaculty: Object.values(facultyMap),
    };
  })();

  const distribution = (() => {
    let filteredDistribution = distributionData;
    if (filters.class !== "all") {
      filteredDistribution = filteredDistribution.filter(
        (hasanatItem) => hasanatItem.class === filters.class,
      );
    }
    if (filters.student) {
      filteredDistribution = filteredDistribution.filter((hasanatItem) =>
        hasanatItem.studentName.toLowerCase().includes(filters.student.toLowerCase()),
      );
    }
    if (selectedFaculty) {
      filteredDistribution = filteredDistribution.filter(
        (hasanatItem) => hasanatItem.faculty === selectedFaculty,
      );
    }
    return filteredDistribution;
  })() as HasanatReportItem[];

  const totalRedeemed = distribution.reduce(
    (total, hasanatItem) => total + hasanatItem.redeemed,
    0,
  );
  const totalBalance = distribution.reduce((total, hasanatItem) => total + hasanatItem.balance, 0);

  const facultyChartData = (() => {
    return hasanatByFaculty.map((facultyTotals) => ({
      faculty: facultyTotals.faculty,
      distributed: facultyTotals.totalDistributed,
      redeemed: facultyTotals.totalRedeemed,
    }));
  })() as HasanatFacultyBarItem[];

  const toggleFacultyFilter = (faculty: string) => {
    setSelectedFaculty((current) => (current === faculty ? null : faculty));
  };

  const redemptionPieData = (() => [
    { name: t("hasanat.report.redeemedPieLabel"), value: totalRedeemed },
    { name: t("hasanat.report.balancePieLabel"), value: totalBalance },
  ])() as HasanatPieItem[];

  if (distQuery.isError || denomsQuery.isError || aggregatesQuery.isError) {
    return (
      <div className="p-4">
        <ErrorState
          title={t("hasanat.loadFailed")}
          description={t("hasanat.loadFailedHint")}
          onRetry={() => {
            void distQuery.refetch();
            void denomsQuery.refetch();
            void aggregatesQuery.refetch();
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
