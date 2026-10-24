import { describe, expect, it } from "vitest";
import { buildBucketedSeries } from "./dashboardSeriesUtils.js";

describe("buildBucketedSeries", () => {
  const buckets = [
    { key: "2026-01", label: "Jan" },
    { key: "2026-02", label: "Feb" },
    { key: "2026-03", label: "Mar" },
  ];

  it("projects each bucket, falling back when a bucket has no value", () => {
    const values = new Map<string, number>([
      ["2026-01", 10],
      ["2026-03", 30],
    ]);

    const points = buildBucketedSeries(buckets, values, (bucket, value) => ({
      month: bucket.label,
      students: value ?? 0,
    }));

    expect(points).toEqual([
      { month: "Jan", students: 10 },
      { month: "Feb", students: 0 },
      { month: "Mar", students: 30 },
    ]);
  });

  it("passes undefined to the projector for missing buckets so callers control fallbacks", () => {
    const values = new Map<string, { revenue: number; expenses: number }>([
      ["2026-01", { revenue: 100, expenses: 40 }],
    ]);

    const points = buildBucketedSeries(buckets, values, (bucket, totals) => ({
      month: bucket.label,
      revenue: totals?.revenue ?? 0,
      expenses: totals?.expenses ?? 0,
    }));

    expect(points).toEqual([
      { month: "Jan", revenue: 100, expenses: 40 },
      { month: "Feb", revenue: 0, expenses: 0 },
      { month: "Mar", revenue: 0, expenses: 0 },
    ]);
  });

  it("returns an empty array for no buckets", () => {
    const points = buildBucketedSeries<{ key: string }, number, { key: string; value: number }>(
      [],
      new Map(),
      (bucket, value) => ({ key: bucket.key, value: value ?? 0 }),
    );
    expect(points).toEqual([]);
  });
});
