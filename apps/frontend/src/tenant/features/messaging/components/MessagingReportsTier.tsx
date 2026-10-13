import type React from "react";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { KPISummary, ModuleReports } from "@/tenant/components/moduleReports";

export interface MessagingReportsTierProps {
  canWrite?: boolean;
}

export function MessagingReportsTier({
  canWrite: _canWrite,
}: MessagingReportsTierProps = {}): React.JSX.Element {
  return (
    <ModuleTierMotion tier="reports" className="space-y-4">
      <ErrorBoundary>
        <KPISummary category="messaging" />
        <ModuleReports category="messaging" />
      </ErrorBoundary>
    </ModuleTierMotion>
  );
}
