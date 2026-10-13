import type React from "react";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { KPISummary, ModuleReports } from "@/tenant/components/moduleReports";

export function FinanceReportsTier(): React.JSX.Element {
  return (
    <ModuleTierMotion tier="reports" className="space-y-4">
      <ErrorBoundary>
        <KPISummary category="finance" />
        <ModuleReports category="finance" />
      </ErrorBoundary>
    </ModuleTierMotion>
  );
}
