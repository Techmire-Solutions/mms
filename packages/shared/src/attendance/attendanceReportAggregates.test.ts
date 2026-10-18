import { describe, expect, it } from "vitest";
import {
  EMPTY_ATTENDANCE_REPORT_OVERVIEW,
  attendanceReportAggregatesSchema,
  normalizeAttendanceReportComparisonQuery,
  attendanceReportComparisonQueryActive,
} from "./attendanceReportAggregates.js";

describe("attendanceReportAggregates", () => {
  it("parses a valid aggregates payload with comparison", () => {
    const parsed = attendanceReportAggregatesSchema.parse({
      overview: EMPTY_ATTENDANCE_REPORT_OVERVIEW,
      comparison: {
        sessions: [{ sessionId: "s1", attendancePct: 85 }],
        monthly: {
          a: [{ monthKey: "2026-01", presentCount: 8, total: 10 }],
          b: [{ monthKey: "2026-02", presentCount: 9, total: 12 }],
        },
      },
    });
    expect(parsed.comparison?.sessions[0]?.attendancePct).toBe(85);
    expect(parsed.comparison?.monthly.a[0]?.presentCount).toBe(8);
  });

  it("normalizeAttendanceReportComparisonQuery caps sessionIds and validates dates", () => {
    expect(
      normalizeAttendanceReportComparisonQuery({
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
    expect(normalizeAttendanceReportComparisonQuery({})).toBeUndefined();
  });

  it("attendanceReportComparisonQueryActive detects any slice", () => {
    expect(attendanceReportComparisonQueryActive({ sessionIds: ["s1"] })).toBe(true);
    expect(
      attendanceReportComparisonQueryActive({
        rangeAFrom: "2026-01-01",
        rangeATo: "2026-01-31",
      }),
    ).toBe(true);
    expect(attendanceReportComparisonQueryActive(undefined)).toBe(false);
  });
});
