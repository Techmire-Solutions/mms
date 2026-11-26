import type React from "react";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import { SubTabBar } from "@mms/ui/app/SubTabBar";
import { AttendanceAnalytics } from "./AttendanceAnalytics";
import { AttendanceCoverageReport } from "./AttendanceCoverageReport";
import { KPISummary, ModuleReports } from "../host/ModuleReportsTier";
import { AttendanceRegisterExport } from "./AttendanceRegisterExport";

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
        <AttendanceRegisterExport classId={filters.classId} />
        <SubTabBar
          tabs={analyticsTabs.map((tab) => ({ key: tab.id, label: tab.label }))}
          value={activeAnalyticsTab}
          onChange={onAnalyticsTabChange}
        />
        {activeAnalyticsTab === "charts" ? (
          <AttendanceAnalytics filters={filters} />
        ) : activeAnalyticsTab === "coverage" ? (
          <AttendanceCoverageReport classId={filters.classId} />
        ) : (
          <ModuleReports category="attendance" />
        )}
      </ErrorBoundary>
    </ModuleTierMotion>
  );
}
