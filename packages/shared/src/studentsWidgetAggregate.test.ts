import { describe, expect, it } from "vitest";
import { computeStudentsWidgetAggregate } from "./studentsWidgetAggregate.js";

describe("studentsWidgetAggregate", () => {
  it("counts all students", () => {
    const students = [
      { id: 1, status: "active" },
      { id: 2, status: "inactive" },
    ];
    const result = computeStudentsWidgetAggregate(students, { id: "total", operation: "count" });
    expect(result.value).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  it("filters by status for percentage", () => {
    const students = [
      { id: 1, status: "active" },
      { id: 2, status: "active" },
      { id: 3, status: "inactive" },
    ];
    const result = computeStudentsWidgetAggregate(students, {
      id: "active-pct",
      operation: "percentage",
      filterField: "status",
      filterOperator: "equals",
      filterValue: "active",
    });
    expect(result.value).toBe(67);
  });

  it("groups chart data by status", () => {
    const students = [
      { id: 1, status: "active" },
      { id: 2, status: "active" },
      { id: 3, status: "suspended" },
    ];
    const result = computeStudentsWidgetAggregate(students, {
      id: "chart",
      operation: "count",
      xAxisField: "status",
    });
    expect(result.chartData).toEqual(
      expect.arrayContaining([
        { name: "active", value: 2 },
        { name: "suspended", value: 1 },
      ]),
    );
  });
});
