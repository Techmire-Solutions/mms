import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  dashboardPreferencesPutBodySchema,
  normalizeDashboardPreferences,
} from "./dashboardPreferencesTypes.js";

describe("normalizeDashboardPreferences", () => {
  it("returns defaults for null / non-object input", () => {
    expect(normalizeDashboardPreferences(null)).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
    expect(normalizeDashboardPreferences(undefined)).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
    expect(normalizeDashboardPreferences("nope" as unknown as Record<string, unknown>)).toEqual(
      DEFAULT_DASHBOARD_PREFERENCES,
    );
  });

  it("merges a valid partial over defaults", () => {
    const normalized = normalizeDashboardPreferences({
      gridMode: "compact",
      enrollmentChartColor: "blue",
      enrollmentChartPeriod: 12,
      revenueChartColor: "emerald",
    });
    expect(normalized.gridMode).toBe("compact");
    expect(normalized.enrollmentChartColor).toBe("blue");
    expect(normalized.enrollmentChartPeriod).toBe(12);
    expect(normalized.revenueChartColor).toBe("emerald");
    expect(normalized.disabledCardIds).toEqual([]);
  });

  it("falls back to defaults for invalid enum / type values", () => {
    const normalized = normalizeDashboardPreferences({
      gridMode: "tight",
      enrollmentChartType: "scatter",
      enrollmentChartPeriod: -3,
      revenueChartColor: 42,
    });
    expect(normalized.gridMode).toBe(DEFAULT_DASHBOARD_PREFERENCES.gridMode);
    expect(normalized.enrollmentChartType).toBe(DEFAULT_DASHBOARD_PREFERENCES.enrollmentChartType);
    expect(normalized.enrollmentChartPeriod).toBe(
      DEFAULT_DASHBOARD_PREFERENCES.enrollmentChartPeriod,
    );
    expect(normalized.revenueChartColor).toBe(DEFAULT_DASHBOARD_PREFERENCES.revenueChartColor);
  });

  it("floors non-integer positive chart periods", () => {
    expect(
      normalizeDashboardPreferences({ enrollmentChartPeriod: 10.9 }).enrollmentChartPeriod,
    ).toBe(10);
  });

  it("accepts disabledCardIds string arrays", () => {
    expect(normalizeDashboardPreferences({ disabledCardIds: ["a", "b"] }).disabledCardIds).toEqual([
      "a",
      "b",
    ]);
    expect(normalizeDashboardPreferences({ disabledCardIds: [1, 2] }).disabledCardIds).toEqual([]);
  });

  it("normalizes and bounds attendance threshold values", () => {
    const valid = normalizeDashboardPreferences({
      lowAttendanceThreshold: 80,
      urgentAttendanceThreshold: 55,
    });
    expect(valid.lowAttendanceThreshold).toBe(80);
    expect(valid.urgentAttendanceThreshold).toBe(55);

    const outOfBounds = normalizeDashboardPreferences({
      lowAttendanceThreshold: 150,
      urgentAttendanceThreshold: -10,
    });
    expect(outOfBounds.lowAttendanceThreshold).toBe(
      DEFAULT_DASHBOARD_PREFERENCES.lowAttendanceThreshold,
    );
    expect(outOfBounds.urgentAttendanceThreshold).toBe(
      DEFAULT_DASHBOARD_PREFERENCES.urgentAttendanceThreshold,
    );
  });
});

describe("dashboardPreferencesPutBodySchema", () => {
  it("parses a full prefs body and allows passthrough keys", () => {
    const parsed = dashboardPreferencesPutBodySchema.safeParse({
      gridMode: "compact",
      enrollmentChartType: "bar",
      extraFutureField: "kept",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.gridMode).toBe("compact");
      expect((parsed.data as Record<string, unknown>).extraFutureField).toBe("kept");
    }
  });

  it("rejects an invalid enum value", () => {
    const parsed = dashboardPreferencesPutBodySchema.safeParse({ gridMode: "tight" });
    expect(parsed.success).toBe(false);
  });
});
