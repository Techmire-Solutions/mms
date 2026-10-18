import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TasksReportsTab } from "./TasksReportsTab";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/contexts/BrandingPaletteContext", () => ({
  useBrandPalette: () => ({
    primary: "#000",
    secondary: "#111",
    charts: ["#222", "#333", "#444", "#555"],
  }),
}));

vi.mock("@/tenant/components/moduleReports", () => ({
  ReportChartCard: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-chart={title}>
      {title}
      {children}
    </div>
  ),
}));

vi.mock("recharts", () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
  Tooltip: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock("@/tenant/features/tasks/hooks/useTasksApi", () => ({
  useTaskMetrics: () => ({
    data: {
      total: 10,
      todo: 3,
      inProgress: 4,
      inReview: 1,
      blocked: 0,
      completed: 2,
      cancelled: 0,
      overdue: 1,
      byPriority: { low: 2, medium: 5, high: 2, urgent: 1 },
    },
    isLoading: false,
  }),
}));

describe("TasksReportsTab", () => {
  it("renders report cards, metrics, and chart titles", () => {
    const html = renderToStaticMarkup(<TasksReportsTab />);
    expect(html).toContain("tasks.metrics.total");
    expect(html).toContain("tasks.metrics.completed");
    expect(html).toContain("tasks.metrics.overdue");
    expect(html).toContain("20%");
    expect(html).toContain("tasks.reports.statusDistribution");
    expect(html).toContain("tasks.reports.priorityDistribution");
    expect(html).toContain("tasks.reports.overdueBreakdown");
  });
});
