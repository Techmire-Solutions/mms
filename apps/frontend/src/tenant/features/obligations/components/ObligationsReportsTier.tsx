import type React from "react";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { KPISummary, ModuleReports } from "@/tenant/components/moduleReports";

export function ObligationsReportsTier(): React.JSX.Element {
  return (
    <ModuleTierMotion tier="reports" className="space-y-4">
      <ErrorBoundary>
        <KPISummary category="obligations" />
        <ModuleReports category="obligations" />
      </ErrorBoundary>
    </ModuleTierMotion>
  );
}
