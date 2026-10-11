import { describe, expect, it } from "vitest";
import {
  buildContactsDateRangeComparison,
  computeDynamicDateRangeComparison,
  computeDynamicSessionComparison,
} from "@/components/ui/reports/comparisonModeCompute";
import type { AppTranslationKey } from "@mms/shared";

const t = (key: AppTranslationKey) => key;

describe("buildContactsDateRangeComparison", () => {
  it("aligns monthly counts for two years by index", () => {
    const result = buildContactsDateRangeComparison(
      [
        {
          year: 2025,
          months: [
            { month: "Jan", count: 3 },
            { month: "Feb", count: 5 },
          ],
        },
        {
          year: 2026,
          months: [
            { month: "Jan", count: 7 },
            { month: "Feb", count: 1 },
          ],
        },
      ],
      { from: "2025-01-01", to: "2025-12-31" },
      { from: "2026-01-01", to: "2026-12-31" },
    );

    expect(result).toEqual([
      { month: "Jan", a: 3, b: 7 },
      { month: "Feb", a: 5, b: 1 },
    ]);
  });

  it("defaults missing B-year buckets to zero", () => {
    const result = buildContactsDateRangeComparison(
      [
        {
          year: 2025,
          months: [{ month: "Jan", count: 2 }],
        },
      ],
      { from: "2025-01-01", to: "2025-01-31" },
      { from: "2026-01-01", to: "2026-01-31" },
    );

    expect(result).toEqual([{ month: "Jan", a: 2, b: 0 }]);
  });
});

describe("computeDynamicSessionComparison (enrollment aggregates)", () => {
  it("uses comparison session counts and hasanat aggregates", () => {
    const result = computeDynamicSessionComparison(
      [
        { id: "s1", name: "Spring", classes: [] },
        { id: "s2", name: "Fall", classes: [] },
      ] as never,
      [
        { sessionId: "s1", enrollmentCount: 4, studentIds: ["st1", "st2"] },
        { sessionId: "s2", enrollmentCount: 1, studentIds: ["st3"] },
      ],
      [],
      [],
      [
        { sessionId: "s1", hasanat: 20 },
        { sessionId: "s2", hasanat: 0 },
      ],
      [],
      "s1",
      "s2",
      t,
    );

    const enrollmentRow = result.find((row) => row.metricKey === "enrollment");
    const hasanatRow = result.find((row) => row.metricKey === "hasanat");
    expect(enrollmentRow).toMatchObject({ a: 4, b: 1 });
    expect(hasanatRow).toMatchObject({ a: 20, b: 0 });
  });

  it("uses finance comparison feeCollected per session", () => {
    const result = computeDynamicSessionComparison(
      [
        { id: "s1", name: "Spring", classes: [] },
        { id: "s2", name: "Fall", classes: [] },
      ] as never,
      [],
      [],
      [
        { sessionId: "s1", feeCollected: 150 },
        { sessionId: "s2", feeCollected: 40 },
      ],
      [],
      [],
      "s1",
      "s2",
      t,
    );

    const feeRow = result.find((row) => row.metricKey === "feeCollected");
    expect(feeRow).toMatchObject({ a: 150, b: 40 });
  });

  it("uses attendance comparison attendancePct per session", () => {
    const result = computeDynamicSessionComparison(
      [
        { id: "s1", name: "Spring", classes: [] },
        { id: "s2", name: "Fall", classes: [] },
      ] as never,
      [],
      [
        { sessionId: "s1", attendancePct: 80 },
        { sessionId: "s2", attendancePct: 50 },
      ],
      [],
      [],
      [],
      "s1",
      "s2",
      t,
    );

    const attendanceRow = result.find((row) => row.metricKey === "attendancePct");
    expect(attendanceRow).toMatchObject({ a: 80, b: 50 });
  });
});

describe("computeDynamicDateRangeComparison (enrollment monthly)", () => {
  it("maps monthly a/b buckets into month-index series", () => {
    const result = computeDynamicDateRangeComparison(
      "enrollments",
      {
        a: [
          { monthKey: "2025-01", count: 3 },
          { monthKey: "2025-02", count: 5 },
        ],
        b: [
          { monthKey: "2026-01", count: 7 },
          { monthKey: "2026-02", count: 1 },
        ],
      },
      undefined,
      undefined,
      undefined,
      undefined,
      { from: "2025-01-01", to: "2025-03-31" },
      { from: "2026-01-01", to: "2026-03-31" },
    );

    expect(result).toEqual([
      { month: "Jan", a: 3, b: 7 },
      { month: "Feb", a: 5, b: 1 },
    ]);
  });
});

describe("computeDynamicDateRangeComparison (finance monthly)", () => {
  it("maps collected monthly a/b buckets into month-index series", () => {
    const result = computeDynamicDateRangeComparison(
      "financial",
      undefined,
      undefined,
      {
        a: [
          { monthKey: "2025-01", collected: 50 },
          { monthKey: "2025-02", collected: 25 },
        ],
        b: [
          { monthKey: "2026-01", collected: 100 },
          { monthKey: "2026-02", collected: 10 },
        ],
      },
      undefined,
      undefined,
      { from: "2025-01-01", to: "2025-03-31" },
      { from: "2026-01-01", to: "2026-03-31" },
    );

    expect(result).toEqual([
      { month: "Jan", a: 50, b: 100 },
      { month: "Feb", a: 25, b: 10 },
    ]);
  });
});

describe("computeDynamicDateRangeComparison (attendance monthly)", () => {
  it("maps presentCount/total monthly a/b buckets into percent series", () => {
    const result = computeDynamicDateRangeComparison(
      "attendance",
      undefined,
      {
        a: [
          { monthKey: "2025-01", presentCount: 8, total: 10 },
          { monthKey: "2025-02", presentCount: 5, total: 10 },
        ],
        b: [
          { monthKey: "2026-01", presentCount: 9, total: 10 },
          { monthKey: "2026-02", presentCount: 1, total: 4 },
        ],
      },
      undefined,
      undefined,
      undefined,
      { from: "2025-01-01", to: "2025-03-31" },
      { from: "2026-01-01", to: "2026-03-31" },
    );

    expect(result).toEqual([
      { month: "Jan", a: 80, b: 90 },
      { month: "Feb", a: 50, b: 25 },
    ]);
  });
});

describe("computeDynamicDateRangeComparison (hasanat monthly)", () => {
  it("maps points monthly a/b buckets into month-index series", () => {
    const result = computeDynamicDateRangeComparison(
      "hasanat",
      undefined,
      undefined,
      undefined,
      {
        a: [
          { monthKey: "2025-01", points: 50 },
          { monthKey: "2025-02", points: 25 },
        ],
        b: [
          { monthKey: "2026-01", points: 100 },
          { monthKey: "2026-02", points: 10 },
        ],
      },
      undefined,
      { from: "2025-01-01", to: "2025-03-31" },
      { from: "2026-01-01", to: "2026-03-31" },
    );

    expect(result).toEqual([
      { month: "Jan", a: 50, b: 100 },
      { month: "Feb", a: 25, b: 10 },
    ]);
  });
});
