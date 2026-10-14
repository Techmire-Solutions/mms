import type React from "react";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import KPISummary from "@/tenant/features/reports/components/KPISummary";
import ModuleReports from "@/tenant/features/reports/components/ModuleReports";
import type { ModuleReportCategory } from "@/tenant/features/reports/components/ModuleReportsToolPanels";

export interface ModuleReportsTierProps {
  category: ModuleReportCategory;
}

/**
 * Shared Reports tier body for standard module pages — KPI summary + reports tools,
 * wrapped in the tier motion + error boundary. Feature pages render this inside
 * `ModuleTierPage`'s `reports` slot instead of re-declaring the wrapper.
 */
export function ModuleReportsTier({ category }: ModuleReportsTierProps): React.JSX.Element {
  return (
    <ModuleTierMotion tier="reports" className="space-y-4">
      <ErrorBoundary>
        <KPISummary category={category} />
        <ModuleReports category={category} />
      </ErrorBoundary>
    </ModuleTierMotion>
  );
}
