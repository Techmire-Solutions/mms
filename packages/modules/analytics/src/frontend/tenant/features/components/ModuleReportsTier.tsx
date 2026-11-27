import type React from "react";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import KPISummary from "./KPISummary";
import ModuleReports from "./ModuleReports";
import type { ModuleReportCategory } from "./ModuleReportsToolPanels";

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
