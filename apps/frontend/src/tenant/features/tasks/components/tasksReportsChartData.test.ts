import { describe, expect, it } from "vitest";
import {
  buildTasksOverdueChartData,
  buildTasksPriorityChartData,
  buildTasksStatusChartData,
  hasChartValues,
} from "../lib/tasksReportsChartData";

const metrics = {
  total: 10,
  todo: 3,
  inProgress: 4,
  inReview: 1,
  blocked: 0,
  completed: 2,
  cancelled: 0,
  overdue: 1,
  byPriority: { low: 2, medium: 5, high: 2, urgent: 1 },
};

describe("tasksReportsChartData", () => {
  it("maps status metrics to chart rows", () => {
    const data = buildTasksStatusChartData(metrics, {
      todo: "Todo",
      inProgress: "In Progress",
      inReview: "In Review",
      blocked: "Blocked",
      completed: "Completed",
      cancelled: "Cancelled",
    });
    expect(data).toEqual([
      { name: "Todo", value: 3 },
      { name: "In Progress", value: 4 },
      { name: "In Review", value: 1 },
      { name: "Blocked", value: 0 },
      { name: "Completed", value: 2 },
      { name: "Cancelled", value: 0 },
    ]);
  });

  it("maps priority metrics to chart rows", () => {
    const data = buildTasksPriorityChartData(metrics, {
      low: "Low",
      medium: "Medium",
      high: "High",
      urgent: "Urgent",
    });
    expect(data).toEqual([
      { name: "Low", value: 2 },
      { name: "Medium", value: 5 },
      { name: "High", value: 2 },
      { name: "Urgent", value: 1 },
    ]);
  });

  it("maps overdue vs on-track values", () => {
    expect(
      buildTasksOverdueChartData(metrics, { overdue: "Overdue", onTrack: "On track" }),
    ).toEqual([
      { name: "Overdue", value: 1 },
      { name: "On track", value: 9 },
    ]);
  });

  it("detects empty chart series", () => {
    expect(hasChartValues([{ name: "a", value: 0 }])).toBe(false);
    expect(hasChartValues([{ name: "a", value: 1 }])).toBe(true);
  });
});
