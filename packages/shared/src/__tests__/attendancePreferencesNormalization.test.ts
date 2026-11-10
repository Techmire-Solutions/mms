import { describe, expect, it } from "vitest";
import { normalizeAttendanceModulePreferences } from "../attendance/attendanceSetupPreferences.js";
import { DEFAULT_ATTENDANCE_SETTINGS } from "../attendance/attendanceModuleSettings.js";

/**
 * Preference normalisation is the last line of defence for the Setup form: an emptied numeric input
 * used to arrive as 0, and the field's `min`/`max` attributes are hints, not validation.
 */
describe("normalizeAttendanceModulePreferences numeric bounds", () => {
  it("clamps the low-attendance threshold into 1–100", () => {
    expect(
      normalizeAttendanceModulePreferences({ lowAttendanceThreshold: 0 }).lowAttendanceThreshold,
    ).toBe(1);
    expect(
      normalizeAttendanceModulePreferences({ lowAttendanceThreshold: 150 }).lowAttendanceThreshold,
    ).toBe(100);
    expect(
      normalizeAttendanceModulePreferences({ lowAttendanceThreshold: 62.4 }).lowAttendanceThreshold,
    ).toBe(62);
    expect(
      normalizeAttendanceModulePreferences({ lowAttendanceThreshold: Number.NaN })
        .lowAttendanceThreshold,
    ).toBe(DEFAULT_ATTENDANCE_SETTINGS.lowAttendanceThreshold);
  });

  it("keeps the grace window inside the auto-absent window", () => {
    const prefs = normalizeAttendanceModulePreferences({
      lateThresholdMins: 90,
      autoAbsentAfterMins: 30,
    });
    expect(prefs.lateThresholdMins).toBeLessThanOrEqual(prefs.autoAbsentAfterMins);
  });

  it("sanitises an invalid clock back to the default", () => {
    expect(normalizeAttendanceModulePreferences({ cutoffTime: "25:99" }).cutoffTime).toBe(
      DEFAULT_ATTENDANCE_SETTINGS.cutoffTime,
    );
  });
});
