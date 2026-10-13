import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceAnalytics } from "./AttendanceAnalytics";

vi.mock("../hooks/useAttendanceAnalyticsModel", () => ({
  useAttendanceAnalyticsModel: () => ({
    t: (key: string) => key,
    overallRate: 92,
    totalStats: { present: 100 },
    lowAttendanceCount: 0,
    lowAttendance: [],
    studentRates: [{ id: "student-1", name: "Ali", rate: 95 }],
    colors: ["#000"],
    classStats: [],
    monthlyTrend: [],
    pieData: [],
    statuses: [],
    topStudents: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/app/ModuleCommandMetricsGrid", () => ({
  ModuleCommandMetricsGrid: ({ items }: { items: { label: string; value: any }[] }) => (
    <div data-testid="metrics-grid">{items.map((i) => `${i.label}:${i.value}`).join(", ")}</div>
  ),
}));

import { AttendanceAnalyticsChartPanels } from "./AttendanceAnalyticsChartPanels";

vi.mock("./AttendanceAnalyticsInsights", () => ({
  AttendanceAnalyticsInsights: () => <div data-testid="insights">Insights</div>,
}));

describe("AttendanceAnalytics Component", () => {
  it("renders metrics grid and insights", () => {
    const html = renderToStaticMarkup(<AttendanceAnalytics filters={{}} />);

    expect(html).toContain("attendance.analytics.kpi.overallAttendance:92%");
    expect(html).toContain("Insights");
  });

  it("renders chart panels", () => {
    const html = renderToStaticMarkup(
      <AttendanceAnalyticsChartPanels
        t={
          ((key: string) => key) as unknown as Parameters<
            typeof AttendanceAnalyticsChartPanels
          >[0]["t"]
        }
        colors={["#000"]}
        classStats={[]}
        monthlyTrend={[]}
        studentRates={[]}
        pieData={[]}
        statuses={[]}
        totalStats={{ present: 100 }}
      />,
    );

    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });
});
