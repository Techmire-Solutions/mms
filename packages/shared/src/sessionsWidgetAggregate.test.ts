import { describe, expect, it } from "vitest";
import { computeSessionsWidgetAggregate } from "./sessionsWidgetAggregate.js";

describe("sessionsWidgetAggregate", () => {
  it("counts all sessions", () => {
    const sessions = [
      { id: 1, status: "active" },
      { id: 2, status: "completed" },
    ];
    const result = computeSessionsWidgetAggregate(sessions, { id: "total", operation: "count" });
    expect(result.value).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  it("filters by status for percentage", () => {
    const sessions = [
      { id: 1, status: "active" },
      { id: 2, status: "active" },
      { id: 3, status: "upcoming" },
    ];
    const result = computeSessionsWidgetAggregate(sessions, {
      id: "active-pct",
      operation: "percentage",
      filterField: "status",
      filterOperator: "equals",
      filterValue: "active",
    });
    expect(result.value).toBe(67);
  });
});
