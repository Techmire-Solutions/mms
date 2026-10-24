import { describe, expect, it } from "vitest";
import {
  aggregateVisualizerRows,
  matchesFilterRule,
} from "@/components/reports/dynamicChartVisualizerHelpers";

describe("aggregateVisualizerRows", () => {
  it("counts rows grouped by dimension", () => {
    const result = aggregateVisualizerRows({
      collectionKey: "students",
      collectionRows: [{ status: "active" }, { status: "active" }, { status: "inactive" }],
      denominations: [],
      filters: [],
      xAxisField: "status",
      operation: "count",
      targetField: "",
    });

    expect(result).toEqual([
      { name: "active", value: 2, count: 2 },
      { name: "inactive", value: 1, count: 1 },
    ]);
  });

  it("applies equals filters before aggregation", () => {
    const result = aggregateVisualizerRows({
      collectionKey: "students",
      collectionRows: [
        { status: "active", grade: "A" },
        { status: "active", grade: "B" },
        { status: "inactive", grade: "A" },
      ],
      denominations: [],
      filters: [{ id: "1", field: "grade", operator: "equals", value: "A" }],
      xAxisField: "status",
      operation: "count",
      targetField: "",
    });

    expect(result).toEqual([
      { name: "active", value: 1, count: 1 },
      { name: "inactive", value: 1, count: 1 },
    ]);
  });

  it("sums numeric target fields", () => {
    const result = aggregateVisualizerRows({
      collectionKey: "finance_invoices",
      collectionRows: [
        { status: "paid", amount: 10 },
        { status: "paid", amount: 5 },
        { status: "unpaid", amount: 20 },
      ],
      denominations: [],
      filters: [],
      xAxisField: "status",
      operation: "sum",
      targetField: "amount",
    });

    expect(result.find((row) => row.name === "paid")).toEqual({
      name: "paid",
      value: 15,
      count: 2,
    });
    expect(result.find((row) => row.name === "unpaid")).toEqual({
      name: "unpaid",
      value: 20,
      count: 1,
    });
  });
});

describe("matchesFilterRule", () => {
  it("matches contains operator case-insensitively", () => {
    expect(
      matchesFilterRule(
        { name: "Ali Khan" },
        { id: "1", field: "name", operator: "contains", value: "khan" },
      ),
    ).toBe(true);
  });
});
