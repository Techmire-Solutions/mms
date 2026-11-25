import { describe, expect, it } from "vitest";
import { calculateReportDateRange } from "./reportDateUtils";

describe("calculateReportDateRange", () => {
  const mockBaseDate = new Date("2026-08-30T12:00:00.000Z");

  it('handles "none" and "allTime" presets', () => {
    expect(calculateReportDateRange("none", mockBaseDate)).toEqual({ from: "", to: "" });
    expect(calculateReportDateRange("allTime", mockBaseDate)).toEqual({ from: "", to: "" });
  });

  it('handles "today" preset', () => {
    expect(calculateReportDateRange("today", mockBaseDate)).toEqual({
      from: "2026-08-30",
      to: "2026-08-30",
    });
  });

  it('handles "7d" preset', () => {
    expect(calculateReportDateRange("7d", mockBaseDate)).toEqual({
      from: "2026-08-23",
      to: "2026-08-30",
    });
  });

  it('handles "30d" preset', () => {
    expect(calculateReportDateRange("30d", mockBaseDate)).toEqual({
      from: "2026-07-31",
      to: "2026-08-30",
    });
  });

  it('handles "90d" preset', () => {
    expect(calculateReportDateRange("90d", mockBaseDate)).toEqual({
      from: "2026-06-01",
      to: "2026-08-30",
    });
  });

  it('handles "thisMonth" preset', () => {
    expect(calculateReportDateRange("thisMonth", mockBaseDate)).toEqual({
      from: "2026-08-01",
      to: "2026-08-30",
    });
  });

  it('handles "lastMonth" preset across regular month', () => {
    expect(calculateReportDateRange("lastMonth", mockBaseDate)).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });

  it('handles "lastMonth" preset in January (year rollback)', () => {
    const janDate = new Date("2026-01-15T10:00:00.000Z");
    expect(calculateReportDateRange("lastMonth", janDate)).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});
