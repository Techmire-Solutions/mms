import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceAnalyticsChartPanels } from "./AttendanceAnalyticsChartPanels";

vi.mock("@/components/app/SafeResponsiveContainer", () => {
  const MockContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  );
  return {
    SafeResponsiveContainer: MockContainer,
    default: MockContainer,
  };
});

vi.mock("@/components/app/ChartGrid", () => ({
  ChartGrid: () => <div data-testid="chart-grid" />,
  chartAxisTick: () => ({}),
}));

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

describe("AttendanceAnalyticsChartPanels Component", () => {
  it("renders class rate, trend, and distribution charts", () => {
    const html = renderToStaticMarkup(
      <AttendanceAnalyticsChartPanels
        t={((k: string) => k) as unknown as never}
        colors={["#000"]}
        classStats={[{ name: "Class 1A", rate: 95 }]}
        monthlyTrend={[{ month: "Jan", rate: 90 }]}
        studentRates={[{ id: "student-1", name: "Ali", rate: 98 }]}
        pieData={[{ name: "Present", value: 40 }]}
        statuses={[{ id: "present", label: "Present" } as unknown as never]}
        totalStats={{ present: 40 }}
      />,
    );

    expect(html).toContain("attendance.analytics.charts.classRateTitle");
    expect(html).toContain("attendance.analytics.charts.monthlyTrendTitle");
    expect(html).toContain("attendance.analytics.charts.statusDistributionTitle");
  });
});
