import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TasksReportsTab } from "./TasksReportsTab";

const state = { isError: false };

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
  ReportChartCard: ({
    title,
    children,
    accessibleSummary,
  }: {
    title: string;
    children: React.ReactNode;
    accessibleSummary?: React.ReactNode;
  }) => (
    <div data-chart={title}>
      {title}
      {children}
      {accessibleSummary}
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
    data: state.isError
      ? undefined
      : {
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
    isError: state.isError,
    refetch: vi.fn(),
  }),
}));

describe("TasksReportsTab", () => {
  afterEach(() => {
    state.isError = false;
  });

  it("renders a retryable error instead of a zeroed dashboard", () => {
    state.isError = true;
    const html = renderToStaticMarkup(<TasksReportsTab />);
    expect(html).toContain("tasks.loadFailed");
    expect(html).toContain("common.tryAgain");
    expect(html).not.toContain("tasks.metrics.total");
  });

  it("renders report cards, metrics, and chart titles", () => {
    const html = renderToStaticMarkup(<TasksReportsTab />);
    expect(html).toContain("tasks.metrics.total");
    expect(html).toContain("tasks.metrics.completed");
    expect(html).toContain("tasks.metrics.overdue");
    expect(html).toContain("20%");
    expect(html).toContain("tasks.reports.statusDistribution");
    expect(html).toContain("tasks.reports.priorityDistribution");
    expect(html).toContain("tasks.reports.overdueBreakdown");
    expect(html).toContain("tasks.status.todo: 3");
  });
});
