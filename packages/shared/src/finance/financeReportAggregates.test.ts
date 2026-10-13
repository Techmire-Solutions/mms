import { describe, expect, it } from "vitest";
import {
  financeReportAggregatesSchema,
  normalizeFinanceReportComparisonQuery,
  financeReportComparisonQueryActive,
} from "./financeReportAggregates.js";

describe("financeReportAggregates", () => {
  it("parses a valid aggregates payload with comparison", () => {
    const parsed = financeReportAggregatesSchema.parse({
      comparison: {
        sessions: [{ sessionId: "s1", feeCollected: 120 }],
        monthly: {
          a: [{ monthKey: "2026-01", collected: 50 }],
          b: [{ monthKey: "2026-02", collected: 70 }],
        },
      },
    });
    expect(parsed.comparison?.sessions[0]?.feeCollected).toBe(120);
    expect(parsed.comparison?.monthly.a[0]?.monthKey).toBe("2026-01");
  });

  it("normalizeFinanceReportComparisonQuery caps sessionIds and validates dates", () => {
    expect(
      normalizeFinanceReportComparisonQuery({
        sessionIds: ["s1", "s2", "s3"],
        rangeAFrom: "2026-01-01",
        rangeATo: "2026-03-31",
        rangeBFrom: "bad",
        rangeBTo: "2026-06-30",
      }),
    ).toEqual({
      sessionIds: ["s1", "s2"],
      rangeAFrom: "2026-01-01",
      rangeATo: "2026-03-31",
    });
    expect(normalizeFinanceReportComparisonQuery({})).toBeUndefined();
  });

  it("financeReportComparisonQueryActive detects any slice", () => {
    expect(financeReportComparisonQueryActive({ sessionIds: ["s1"] })).toBe(true);
    expect(
      financeReportComparisonQueryActive({
        rangeAFrom: "2026-01-01",
        rangeATo: "2026-01-31",
      }),
    ).toBe(true);
    expect(financeReportComparisonQueryActive(undefined)).toBe(false);
  });
});
