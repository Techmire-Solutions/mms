import type React from "react";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { SubTabBar } from "@/components/app/SubTabBar";
import { AttendanceAnalytics } from "@/tenant/features/attendance/components/AttendanceAnalytics";
import { KPISummary, ModuleReports } from "@/tenant/components/moduleReports";

export type AttendanceReportTab = {
  id: string;
  label: string;
};

export interface AttendanceReportsTierProps {
  role: string;
  filters: React.ComponentProps<typeof AttendanceAnalytics>["filters"];
  analyticsTabs: AttendanceReportTab[];
  activeAnalyticsTab: string;
  onAnalyticsTabChange: (next: string) => void;
}

export function AttendanceReportsTier({
  role,
  filters,
  analyticsTabs,
  activeAnalyticsTab,
  onAnalyticsTabChange,
}: AttendanceReportsTierProps): React.JSX.Element {
  return (
    <ModuleTierMotion tier="reports" className="space-y-4">
      <ErrorBoundary>
        <KPISummary category="attendance" role={role} />
        <SubTabBar
          tabs={analyticsTabs.map((tab) => ({ key: tab.id, label: tab.label }))}
          value={activeAnalyticsTab}
          onChange={onAnalyticsTabChange}
        />
        {activeAnalyticsTab === "charts" ? (
          <AttendanceAnalytics filters={filters} />
        ) : (
          <ModuleReports category="attendance" />
        )}
      </ErrorBoundary>
    </ModuleTierMotion>
  );
}
