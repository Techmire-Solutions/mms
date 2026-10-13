import { describe, expect, it } from "vitest";
import { computeFacultyWidgetAggregate } from "./facultyWidgetAggregate.js";

describe("computeFacultyWidgetAggregate", () => {
  it("counts all faculty", () => {
    const faculty = [
      { id: 1, status: "active" },
      { id: 2, status: "inactive" },
    ];
    const result = computeFacultyWidgetAggregate(faculty, { id: "total", operation: "count" });
    expect(result.value).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  it("filters by status for percentage", () => {
    const faculty = [
      { id: 1, status: "active" },
      { id: 2, status: "active" },
      { id: 3, status: "on_leave" },
    ];
    const result = computeFacultyWidgetAggregate(faculty, {
      id: "active-pct",
      operation: "percentage",
      filterField: "status",
      filterOperator: "equals",
      filterValue: "active",
    });
    expect(result.value).toBe(67);
  });
});
