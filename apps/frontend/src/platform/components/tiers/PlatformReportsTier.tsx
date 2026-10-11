import React, { Suspense, lazy } from "react";
import { StatsSkeleton } from "@/components/ui/LoadingState";

const PlatformReports = lazy(() =>
  import("@/platform/components/PlatformReports").then((m) => ({ default: m.PlatformReports })),
);

export type PlatformReportsSubTab = "analytics";

export interface PlatformReportsTierProps {
  activeSubTab?: PlatformReportsSubTab;
  onSubTabChange?: (tab: PlatformReportsSubTab) => void;
}

function ReportsFallback(): React.JSX.Element {
  return <StatsSkeleton count={3} />;
}

/**
 * Platform Reports Tier.
 * Exclusively owns workspace analytics, growth trends, module adoption, and CSV exports.
 * Operational infrastructure telemetry lives in PlatformDashboard.
 */
export function PlatformReportsTier({
  activeSubTab: _activeSubTab,
  onSubTabChange: _onSubTabChange,
}: PlatformReportsTierProps = {}): React.JSX.Element {
  return (
    <div className="space-y-6">
      <Suspense fallback={<ReportsFallback />}>
        <PlatformReports />
      </Suspense>
    </div>
  );
}
