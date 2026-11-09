import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_MATRIX_MAX_CELLS,
  ATTENDANCE_MATRIX_MAX_DAYS,
  attendanceMatrixDates,
  attendanceMatrixCellCode,
  buildAttendanceMatrixChunk,
  buildAttendanceMatrixFooter,
  type AttendanceMatrixStatus,
  type AttendanceMatrixStudent,
} from "@mms/shared";
import { buildCsvContent } from "@mms/shared";

/** Matrix grid + caps + CSV safety. The injection test is the point: a student name is user data. */

const DAYS = ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"];

function student(
  id: string,
  name: string,
  marks: Record<string, AttendanceMatrixStatus>,
): AttendanceMatrixStudent {
  return {
    studentId: id,
    studentName: name,
    rollNo: id.replace("s", "R"),
    marks: new Map(Object.entries(marks)),
  };
}

describe("attendanceMatrixDates", () => {
  it("builds an inclusive day list", () => {
    const result = attendanceMatrixDates("2026-03-01", "2026-03-04");
    expect(result).toMatchObject({ ok: true });
    if (result.ok)
      expect(result.dates).toEqual(["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04"]);
  });

  it("rejects an inverted or over-long range", () => {
    expect(attendanceMatrixDates("2026-03-05", "2026-03-01")).toMatchObject({ ok: false });
    const tooLong = attendanceMatrixDates("2026-01-01", "2026-12-31");
    expect(tooLong).toMatchObject({ ok: false });
    if (!tooLong.ok) expect(tooLong.reason).toContain(String(ATTENDANCE_MATRIX_MAX_DAYS));
  });
});

describe("buildAttendanceMatrixChunk", () => {
  it("renders codes, per-student totals and daily totals", () => {
    const chunk = buildAttendanceMatrixChunk(
      [
        student("s1", "Amina", {
          "2026-03-02": "present",
          "2026-03-03": "late",
          "2026-03-04": "absent",
        }),
        student("s2", "Bilal", { "2026-03-02": "present", "2026-03-05": "excused" }),
      ],
      DAYS,
      { withHeader: true },
    );

    expect(chunk.grid[0]).toEqual([
      "Roll No",
      "Student",
      "03-02",
      "03-03",
      "03-04",
      "03-05",
      "Present",
      "Late",
      "Absent",
      "Excused",
      "Marked",
      "Attendance %",
    ]);
    expect(chunk.grid[1]?.slice(2, 6)).toEqual(["P", "L", "A", "—"]);
    expect(chunk.grid[1]?.slice(6)).toEqual(["1", "1", "1", "0", "3", "67"]);
    expect(chunk.grid[2]?.slice(2, 6)).toEqual(["P", "—", "—", "E"]);
    expect(chunk.daily[0]).toEqual({ present: 2, late: 0, absent: 0, excused: 0 });
    expect(chunk.totals).toEqual({ present: 2, late: 1, absent: 1, excused: 1, marked: 5 });
  });

  it("omits the header on subsequent chunks", () => {
    const chunk = buildAttendanceMatrixChunk([student("s1", "Amina", {})], DAYS, {
      withHeader: false,
    });
    expect(chunk.grid[0]?.[0]).toBe("R1");
  });

  it("neutralises CSV formula injection in a student name", () => {
    const chunk = buildAttendanceMatrixChunk(
      [student("s1", '=HYPERLINK("http://evil","click")', { "2026-03-02": "present" })],
      DAYS,
      { withHeader: true },
    );
    const csv = buildCsvContent(chunk.grid);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/(^|,)"?=HYPERLINK/m);
  });

  it("preserves negative numerics and renders an unknown status as a dash", () => {
    expect(attendanceMatrixCellCode(undefined)).toBe("—");
    expect(buildCsvContent([[-5]])).toBe('"-5"');
  });

  it("builds a footer with daily present totals", () => {
    const footer = buildAttendanceMatrixFooter(
      DAYS,
      [
        { present: 2, late: 1, absent: 0, excused: 0 },
        { present: 1, late: 0, absent: 1, excused: 0 },
        { present: 0, late: 0, absent: 0, excused: 0 },
        { present: 0, late: 0, absent: 0, excused: 0 },
      ],
      { present: 3, late: 1, absent: 1, excused: 0, marked: 5 },
    );
    expect(footer[0]?.slice(2, 6)).toEqual(["3", "1", "0", "0"]);
    expect(footer[0]?.slice(-6)).toEqual(["3", "1", "1", "0", "5", "80"]);
  });

  it("keeps the cell budget message actionable", () => {
    expect(ATTENDANCE_MATRIX_MAX_CELLS).toBeGreaterThan(0);
  });
});
