import type React from "react";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { KPISummary, ModuleReports } from "@/tenant/components/moduleReports";
import { ExaminationsReportCharts } from "./ExaminationsReportCharts";

/**
 * Examinations Reports tier: the standard KPI + reports blocks plus the exam-specific analytics
 * (subject pass/fail, grade distribution, top performers, section averages).
 */
export function ExaminationsReportsTier(): React.JSX.Element {
  return (
    <ModuleTierMotion tier="reports" className="space-y-4">
      <ErrorBoundary>
        <KPISummary category="examinations" />
        <ExaminationsReportCharts />
        <ModuleReports category="examinations" />
      </ErrorBoundary>
    </ModuleTierMotion>
  );
}
