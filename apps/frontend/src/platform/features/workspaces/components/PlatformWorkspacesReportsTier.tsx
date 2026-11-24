import React, { lazy, Suspense } from "react";
import { StatsSkeleton } from "@shared/ui";

const PlatformReports = lazy(() =>
  import("@/platform/features/reports/components/PlatformReports").then((module) => ({
    default: module.PlatformReports,
  })),
);

/** Workspaces → Reports: fleet growth, adoption, and module-usage analytics. */
export function PlatformWorkspacesReportsTier(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <Suspense fallback={<StatsSkeleton count={3} />}>
        <PlatformReports />
      </Suspense>
    </div>
  );
}
