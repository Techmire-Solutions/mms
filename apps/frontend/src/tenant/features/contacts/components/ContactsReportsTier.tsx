import type React from "react";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { KPISummary, ModuleReports } from "@/tenant/components/moduleReports";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";

export function ContactsReportsTier(): React.JSX.Element {
  return (
    <ModuleTierMotion tier="reports" className="space-y-4">
      <ErrorBoundary>
        <KPISummary category="contacts" />
        <ModuleReports category="contacts" />
      </ErrorBoundary>
    </ModuleTierMotion>
  );
}
