import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TasksCommandMetrics } from "./TasksCommandMetrics";
import type { TaskMetricsResponse } from "../hooks/useTasksApi";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const metrics: TaskMetricsResponse = {
  total: 25,
  todo: 8,
  inProgress: 6,
  inReview: 3,
  blocked: 2,
  completed: 5,
  cancelled: 1,
  overdue: 4,
  byPriority: { low: 5, medium: 9, high: 7, urgent: 4 },
};

describe("TasksCommandMetrics Component", () => {
  it("renders the command KPI cards from server metrics and the filtered total", () => {
    const html = renderToStaticMarkup(<TasksCommandMetrics metrics={metrics} shown={12} />);

    expect(html).toContain("tasks.metrics.total");
    expect(html).toContain("25");
    expect(html).toContain("tasks.metrics.filtered");
    expect(html).toContain("12");
    expect(html).toContain("tasks.metrics.inProgress");
    expect(html).toContain("6");
    expect(html).toContain("tasks.metrics.blocked");
    expect(html).toContain("2");
    expect(html).toContain("tasks.metrics.overdue");
    expect(html).toContain("4");
    expect(html).toContain("tasks.metrics.completed");
    expect(html).toContain("5");
  });

  it("renders an em-dash placeholder until the metrics query settles", () => {
    const html = renderToStaticMarkup(<TasksCommandMetrics metrics={undefined} shown={0} />);

    expect(html).toContain("tasks.metrics.total");
    expect(html).toContain("—");
    expect(html).not.toContain(">25<");
  });
});
