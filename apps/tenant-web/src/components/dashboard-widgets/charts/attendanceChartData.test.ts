import { describe, expect, it } from "vitest";
import { buildWeeklyAttendancePoints } from "./attendanceChartData";

describe("buildWeeklyAttendancePoints", () => {
  it("returns 7 weekday points with zero rates when records are empty", () => {
    const points = buildWeeklyAttendancePoints([]);
    expect(points).toHaveLength(7);
    expect(points.every((p) => p.rate === 0)).toBe(true);
  });

  it("calculates attendance percentage for days with records", () => {
    const records = [
      { date: "2026-08-17", status: "present" }, // Monday
      { date: "2026-08-17", status: "absent" },
      { date: "2026-08-17", status: "late" },
    ];

    const points = buildWeeklyAttendancePoints(records);
    expect(points).toHaveLength(7);
    // Monday is index 0 -> 2 present/late out of 3 = 67%
    expect(points[0].rate).toBe(67);
  });
});
