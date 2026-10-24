import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceReportsTier } from "./AttendanceReportsTier";

vi.mock("@/tenant/components/moduleReports", () => ({
  KPISummary: ({ category }: { category: string }) => (
    <div data-testid="kpi-summary">KPI Summary: {category}</div>
  ),
  ModuleReports: ({ category }: { category: string }) => (
    <div data-testid="module-reports">Module Reports: {category}</div>
  ),
}));

vi.mock("@/tenant/features/attendance/components/AttendanceAnalytics", () => ({
  AttendanceAnalytics: () => <div data-testid="analytics">Attendance Analytics</div>,
}));

vi.mock("@/components/app/SubTabBar", () => ({
  SubTabBar: ({ tabs }: { tabs: { label: string }[] }) => (
    <div data-testid="sub-tab-bar">{tabs.map((tab) => tab.label).join(", ")}</div>
  ),
}));

describe("AttendanceReportsTier Component", () => {
  it("renders KPI summary and analytics charts when active", () => {
    const html = renderToStaticMarkup(
      <AttendanceReportsTier
        role="admin"
        filters={{ date: "2025-01-01", session: "all", classId: "all" } as unknown as never}
        analyticsTabs={[
          { id: "charts", label: "Charts" },
          { id: "reports", label: "Reports" },
        ]}
        activeAnalyticsTab="charts"
        onAnalyticsTabChange={vi.fn()}
      />,
    );

    expect(html).toContain("KPI Summary: attendance");
    expect(html).toContain("Attendance Analytics");
  });
});
