import { describe, expect, it } from "vitest";
import type { AttendanceRecord } from "@mms/shared";
import { getMonthlyTrend } from "./attendanceData";

function attendanceRecord(
  id: string,
  date: string,
  status: AttendanceRecord["status"],
): AttendanceRecord {
  return {
    id,
    classId: "class-1",
    studentId: `student-${id}`,
    studentName: `Student ${id}`,
    rollNo: id,
    date,
    status,
    timeIn: "",
    timeOut: "",
    notes: "",
  };
}

describe("getMonthlyTrend", () => {
  it("returns only months backed by attendance records", () => {
    const trend = getMonthlyTrend("class-1", [
      attendanceRecord("1", "2026-01-10", "present"),
      attendanceRecord("2", "2026-01-11", "absent"),
      attendanceRecord("3", "2026-03-10", "late"),
    ]);

    expect(trend).toEqual([
      { month: "Jan", rate: 50 },
      { month: "Mar", rate: 100 },
    ]);
  });
});
