import { describe, it, expect } from "vitest";
import {
  ensureAllSessionsInComparison,
  normalizeReportComparisonQuery,
  reportComparisonQueryActive,
  parseComparisonQueryParams,
  reportComparisonQuerySchema,
} from "./reportComparisonQuery.js";

describe("reportComparisonQuery (Shared SSOT)", () => {
  it("normalizes sessionIds to max 2 items and trims whitespace", () => {
    const result = normalizeReportComparisonQuery({
      sessionIds: ["  s-1  ", "s-2", "s-3"],
    });
    expect(result?.sessionIds).toEqual(["s-1", "s-2"]);
  });

  it("validates ISO date format YYYY-MM-DD", () => {
    const valid = normalizeReportComparisonQuery({
      rangeAFrom: "2026-01-01",
      rangeATo: "2026-01-31",
    });
    expect(valid?.rangeAFrom).toBe("2026-01-01");
    expect(valid?.rangeATo).toBe("2026-01-31");

    const invalid = normalizeReportComparisonQuery({
      rangeAFrom: "not-a-date",
      rangeATo: "2026-01-31",
    });
    expect(invalid).toBeUndefined();
  });

  it("returns undefined when no valid comparison criteria provided", () => {
    expect(normalizeReportComparisonQuery(undefined)).toBeUndefined();
    expect(normalizeReportComparisonQuery({})).toBeUndefined();
    expect(normalizeReportComparisonQuery({ sessionIds: [] })).toBeUndefined();
  });

  it("detects when comparison query is active", () => {
    expect(reportComparisonQueryActive(undefined)).toBe(false);
    expect(reportComparisonQueryActive({})).toBe(false);
    expect(reportComparisonQueryActive({ sessionIds: ["s-1"] })).toBe(true);
    expect(reportComparisonQueryActive({ rangeAFrom: "2026-01-01", rangeATo: "2026-01-31" })).toBe(
      true,
    );
    expect(reportComparisonQueryActive({ rangeBFrom: "2026-02-01", rangeBTo: "2026-02-28" })).toBe(
      true,
    );
  });

  it("parses raw query string parameters into typed array", () => {
    const parsed = parseComparisonQueryParams({
      sessionIds: "s-1, s-2 , s-3",
      rangeAFrom: "2026-01-01",
      rangeATo: "2026-01-31",
    });
    expect(parsed.sessionIds).toEqual(["s-1", "s-2", "s-3"]);
    expect(parsed.rangeAFrom).toBe("2026-01-01");
    expect(parsed.rangeATo).toBe("2026-01-31");
  });

  it("validates schema bounds with zod", () => {
    const valid = reportComparisonQuerySchema.safeParse({
      sessionIds: "s-1,s-2",
      rangeAFrom: "2026-01-01",
      rangeATo: "2026-01-31",
    });
    expect(valid.success).toBe(true);

    const invalid = reportComparisonQuerySchema.safeParse({
      sessionIds: "a".repeat(201),
    });
    expect(invalid.success).toBe(false);
  });

  it("ensures all requested session IDs are present with fallback records", () => {
    const initial = [{ sessionId: "s-1", fee: 100 }];
    const filled = ensureAllSessionsInComparison(initial, ["s-1", "s-2", "s-3"], (id) => ({
      sessionId: id,
      fee: 0,
    }));
    expect(filled).toEqual([
      { sessionId: "s-1", fee: 100 },
      { sessionId: "s-2", fee: 0 },
      { sessionId: "s-3", fee: 0 },
    ]);
  });
});
