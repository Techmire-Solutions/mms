import { describe, expect, it } from "vitest";
import {
  hasanatReportAggregatesSchema,
  normalizeHasanatReportComparisonQuery,
  hasanatReportComparisonQueryActive,
} from "./hasanatReportAggregates.js";

describe("hasanatReportAggregates", () => {
  it("parses a valid aggregates payload with comparison", () => {
    const parsed = hasanatReportAggregatesSchema.parse({
      comparison: {
        sessions: [{ sessionId: "s1", hasanat: 250 }],
        monthly: {
          a: [{ monthKey: "2026-01", points: 100 }],
          b: [{ monthKey: "2026-02", points: 150 }],
        },
      },
    });
    expect(parsed.comparison?.sessions[0]?.hasanat).toBe(250);
    expect(parsed.comparison?.monthly.a[0]?.points).toBe(100);
  });

  it("normalizeHasanatReportComparisonQuery caps sessionIds and validates dates", () => {
    expect(
      normalizeHasanatReportComparisonQuery({
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
    expect(normalizeHasanatReportComparisonQuery({})).toBeUndefined();
  });

  it("hasanatReportComparisonQueryActive detects any slice", () => {
    expect(hasanatReportComparisonQueryActive({ sessionIds: ["s1"] })).toBe(true);
    expect(
      hasanatReportComparisonQueryActive({
        rangeAFrom: "2026-01-01",
        rangeATo: "2026-01-31",
      }),
    ).toBe(true);
    expect(hasanatReportComparisonQueryActive(undefined)).toBe(false);
  });
});
