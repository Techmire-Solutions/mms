import { describe, expect, it } from "vitest";
import {
  addMinutesToHhmm,
  evaluateAttendanceWrite,
  hhmmToMinutes,
  isPastAttendanceCutoff,
  minutesToHhmm,
  type AttendanceModulePreferences,
  type AttendancePolicyRow,
} from "@mms/shared";

/**
 * The configurable attendance rules — cut-off, late grace, note requirement, approved leave and
 * the submitted-day lock. Pure matrix: every branch is pinned here because the whole point of the
 * change is that these preferences stop being decorative.
 */

function preferences(
  overrides: Partial<AttendanceModulePreferences> = {},
): AttendanceModulePreferences {
  return {
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    cutoffTime: "09:30",
    lateThresholdMins: 15,
    autoAbsentAfterMins: 30,
    qrEnabled: false,
    lowAttendanceThreshold: 75,
    notifyParents: false,
    requireNoteForAbsent: true,
    lockAfterSubmit: true,
    trackHalfDay: true,
    weeklyReport: false,
    attendanceAlerts: false,
    allowManualOverride: false,
    offlineEnabled: false,
    geoTagging: false,
    allowExtraClassOnHolidays: false,
    defaultViewLayout: "list",
    ...overrides,
  };
}

function row(overrides: Partial<AttendancePolicyRow> = {}): AttendancePolicyRow {
  return {
    classId: "class-a",
    studentId: "student-1",
    date: "2026-03-02",
    status: "present",
    timeIn: "07:00",
    timeOut: "08:30",
    notes: "",
    ...overrides,
  };
}

const CONTEXT = { today: "2026-03-02", nowTime: "08:00", canOverride: false };

describe("attendance clock helpers", () => {
  it("parses and formats HH:mm and rejects anything else", () => {
    expect(hhmmToMinutes("09:30")).toBe(570);
    expect(hhmmToMinutes("00:00")).toBe(0);
    expect(hhmmToMinutes("23:59")).toBe(1439);
    expect(hhmmToMinutes("9:30")).toBeNull();
    expect(hhmmToMinutes("24:00")).toBeNull();
    expect(hhmmToMinutes("")).toBeNull();
    expect(minutesToHhmm(570)).toBe("09:30");
    expect(minutesToHhmm(1440)).toBe("00:00");
  });

  it("adds a grace window to a clock value", () => {
    expect(addMinutesToHhmm("09:30", 15)).toBe("09:45");
    expect(addMinutesToHhmm("23:50", 20)).toBe("00:10");
    expect(addMinutesToHhmm("nope", 20)).toBeNull();
  });

  it("treats earlier days as closed and later days as open", () => {
    expect(isPastAttendanceCutoff("2026-03-01", "2026-03-02", "08:00", "09:30")).toBe(true);
    expect(isPastAttendanceCutoff("2026-03-03", "2026-03-02", "10:00", "09:30")).toBe(false);
    // Same day: strict comparison, so exactly at the cut-off is still open.
    expect(isPastAttendanceCutoff("2026-03-02", "2026-03-02", "09:30", "09:30")).toBe(false);
    expect(isPastAttendanceCutoff("2026-03-02", "2026-03-02", "09:31", "09:30")).toBe(true);
  });
});

describe("evaluateAttendanceWrite — cut-off", () => {
  it("blocks a mark after the cut-off without override", () => {
    const errors = evaluateAttendanceWrite(row(), preferences(), {
      ...CONTEXT,
      nowTime: "10:00",
    });
    expect(errors.map((error) => error.code)).toEqual(["attendance_cutoff_passed"]);
    expect(errors[0]?.status).toBe(409);
  });

  it("allows the same mark when the caller may override", () => {
    const errors = evaluateAttendanceWrite(row(), preferences(), {
      ...CONTEXT,
      nowTime: "10:00",
      canOverride: true,
    });
    expect(errors).toEqual([]);
  });

  it("never blocks future days", () => {
    const errors = evaluateAttendanceWrite(row({ date: "2026-03-09" }), preferences(), {
      ...CONTEXT,
      nowTime: "23:59",
    });
    expect(errors).toEqual([]);
  });
});

describe("evaluateAttendanceWrite — late grace", () => {
  const at = (timeIn: string) =>
    evaluateAttendanceWrite(row({ status: "present", timeIn, timeOut: "" }), preferences(), {
      ...CONTEXT,
      nowTime: "08:00",
    }).map((error) => error.code);

  it("allows present up to the cut-off plus grace", () => {
    expect(at("09:45")).toEqual([]);
  });

  it("requires a late mark after the grace window", () => {
    expect(at("09:46")).toEqual(["attendance_late_threshold"]);
  });

  it("does not constrain a present mark without a time", () => {
    expect(at("")).toEqual([]);
  });
});

describe("evaluateAttendanceWrite — evidence preconditions", () => {
  it("requires a note for absent/excused when the school asks for one", () => {
    const errors = evaluateAttendanceWrite(
      row({ status: "absent", timeIn: "", timeOut: "", notes: "  " }),
      preferences({ requireNoteForAbsent: true }),
      CONTEXT,
    );
    expect(errors.map((error) => error.code)).toEqual(["attendance_note_required"]);
  });

  it("does not require a note when the preference is off", () => {
    const errors = evaluateAttendanceWrite(
      row({ status: "absent", timeIn: "", timeOut: "", notes: "" }),
      preferences({ requireNoteForAbsent: false }),
      CONTEXT,
    );
    expect(errors).toEqual([]);
  });

  it("refuses a present mark on an approved leave day without override", () => {
    const errors = evaluateAttendanceWrite(row(), preferences(), {
      ...CONTEXT,
      isApprovedLeave: () => true,
    });
    expect(errors.map((error) => error.code)).toEqual(["attendance_on_approved_leave"]);
  });

  it("allows an excused mark on an approved leave day", () => {
    const errors = evaluateAttendanceWrite(
      row({ status: "excused", timeIn: "", timeOut: "", notes: "sick" }),
      preferences(),
      { ...CONTEXT, isApprovedLeave: () => true },
    );
    expect(errors).toEqual([]);
  });

  it("locks a submitted day when lockAfterSubmit is on", () => {
    const errors = evaluateAttendanceWrite(row(), preferences(), {
      ...CONTEXT,
      isDaySubmitted: () => true,
    });
    expect(errors.map((error) => error.code)).toEqual(["attendance_day_locked"]);
  });

  it("keeps a submitted day editable when lockAfterSubmit is off", () => {
    const errors = evaluateAttendanceWrite(row(), preferences({ lockAfterSubmit: false }), {
      ...CONTEXT,
      isDaySubmitted: () => true,
    });
    expect(errors).toEqual([]);
  });
});

describe("evaluateAttendanceWrite — time sanity", () => {
  it("rejects a late mark without a time-in", () => {
    const errors = evaluateAttendanceWrite(
      row({ status: "late", timeIn: "", timeOut: "" }),
      preferences(),
      CONTEXT,
    );
    expect(errors.map((error) => error.code)).toEqual(["attendance_time_invalid"]);
  });

  it("rejects a time-out before a time-in", () => {
    const errors = evaluateAttendanceWrite(
      row({ status: "present", timeIn: "08:30", timeOut: "07:00" }),
      preferences(),
      CONTEXT,
    );
    expect(errors.map((error) => error.code)).toEqual(["attendance_time_invalid"]);
  });

  it("rejects arrival times on an absent mark", () => {
    const errors = evaluateAttendanceWrite(
      row({ status: "absent", timeIn: "07:00", timeOut: "", notes: "sick" }),
      preferences(),
      CONTEXT,
    );
    expect(errors.map((error) => error.code)).toEqual(["attendance_time_invalid"]);
  });
});

describe("evaluateAttendanceWrite — transition set", () => {
  it("allows unexcused absent to excused absent with a reason (the brief's example)", () => {
    const errors = evaluateAttendanceWrite(
      row({ status: "excused", timeIn: "", timeOut: "", notes: "Guardian letter" }),
      preferences(),
      { ...CONTEXT, existing: row({ status: "absent", timeIn: "", timeOut: "" }) },
    );
    expect(errors).toEqual([]);
  });

  it("reports every violation of a row, not just the first", () => {
    const errors = evaluateAttendanceWrite(
      row({ status: "late", timeIn: "", timeOut: "" }),
      preferences({ requireNoteForAbsent: true }),
      { ...CONTEXT, nowTime: "11:00" },
    );
    expect(errors.map((error) => error.code)).toContain("attendance_time_invalid");
    expect(errors.map((error) => error.code)).toContain("attendance_cutoff_passed");
  });
});
