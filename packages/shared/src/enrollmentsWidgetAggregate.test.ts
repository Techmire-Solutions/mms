import { describe, expect, it } from "vitest";
import { computeEnrollmentsWidgetAggregate } from "./enrollmentsWidgetAggregate.js";

describe("enrollmentsWidgetAggregate", () => {
  it("counts all enrollments", () => {
    const enrollments = [
      { id: 1, status: "confirmed" },
      { id: 2, status: "pending" },
    ];
    const result = computeEnrollmentsWidgetAggregate(enrollments, {
      id: "total",
      operation: "count",
    });
    expect(result.value).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  it("filters by status for percentage", () => {
    const enrollments = [
      { id: 1, status: "confirmed" },
      { id: 2, status: "confirmed" },
      { id: 3, status: "pending" },
    ];
    const result = computeEnrollmentsWidgetAggregate(enrollments, {
      id: "confirmed-pct",
      operation: "percentage",
      filterField: "status",
      filterOperator: "equals",
      filterValue: "confirmed",
    });
    expect(result.value).toBe(67);
  });

  it("sums finalFee with chart by sessionName", () => {
    const enrollments = [
      { id: 1, status: "confirmed", sessionName: "Hifz", finalFee: 100 },
      { id: 2, status: "pending", sessionName: "Hifz", finalFee: 50 },
      { id: 3, status: "confirmed", sessionName: "Nazira", finalFee: 40 },
    ];
    const result = computeEnrollmentsWidgetAggregate(enrollments, {
      id: "fees",
      operation: "sum",
      targetField: "finalFee",
      xAxisField: "sessionName",
    });
    expect(result.value).toBe(190);
    expect(result.chartData[0]).toEqual({ name: "Hifz", value: 150 });
  });
});
