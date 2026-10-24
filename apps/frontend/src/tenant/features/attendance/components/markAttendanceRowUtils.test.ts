import { describe, expect, it } from "vitest";
import {
  buildDefaultRows,
  attendanceRowsFromRecords,
  attendanceRecordsFromRows,
  studentRollNo,
  enrolledStudentsForClass,
} from "../lib/markAttendanceRowUtils";
import type { ClassStudent } from "@/lib/data/attendanceData";
import type { Enrollment } from "@/lib/data/enrollmentData";
import type { Student } from "@/lib/data/studentsData";

describe("markAttendanceRowUtils utilities", () => {
  it("builds default rows with custom fields", () => {
    const students: ClassStudent[] = [
      { id: "std-1", name: "Bilal", gender: "male", rollNo: "GR-001" },
    ];
    const customFields = [
      {
        id: "homework",
        label: "Homework",
        type: "boolean",
        defaultValue: false,
      } as unknown as never,
    ];

    const rows = buildDefaultRows(students, customFields);
    expect(rows.length).toBe(1);
    expect(rows[0].studentId).toBe("std-1");
    expect(rows[0].homework).toBe(false);
  });

  it("converts between rows and records cleanly", () => {
    const rows = [
      {
        studentId: "std-1",
        name: "Bilal",
        rollNo: "GR-001",
        status: "present" as const,
        timeIn: "08:00",
        timeOut: "12:00",
        notes: "Test",
      },
    ];

    const records = attendanceRecordsFromRows(rows, [], "cls-1", "2025-01-01");
    expect(records.length).toBe(1);
    expect(records[0].id).toBe("cls-1-2025-01-01-std-1");
    expect(records[0].status).toBe("present");

    const convertedRows = attendanceRowsFromRecords(records);
    expect(convertedRows[0].studentId).toBe("std-1");
    expect(convertedRows[0].name).toBe("Bilal");
  });

  it("calculates studentRollNo properly", () => {
    const student = { grNumber: "GR-99" } as Student;
    expect(studentRollNo(student, "std-1")).toBe("GR-99");
    expect(studentRollNo(undefined, "std-12")).toBe("STU-012");
  });

  it("finds enrolledStudentsForClass correctly", () => {
    const enrollments: Enrollment[] = [
      {
        id: "enr-1",
        studentId: "std-1",
        classId: "cls-1",
        status: "confirmed",
      } as unknown as never,
      {
        id: "enr-2",
        studentId: "std-2",
        classId: "cls-1",
        status: "completed",
      } as unknown as never,
      {
        id: "enr-3",
        studentId: "std-3",
        classId: "cls-1",
        status: "cancelled",
      } as unknown as never,
    ];
    const students: Student[] = [
      { id: "std-1", name: "Bilal", gender: "male", grNumber: "GR-01" } as unknown as never,
      { id: "std-2", name: "Hamza", gender: "male", grNumber: "GR-02" } as unknown as never,
      { id: "std-3", name: "Usman", gender: "male", grNumber: "GR-03" } as unknown as never,
    ];

    const list = enrolledStudentsForClass("cls-1", enrollments, students, "Unnamed");
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe("Bilal");
    expect(list[0].rollNo).toBe("GR-01");
    expect(list[1].name).toBe("Hamza");
    expect(list.map((student) => student.id)).not.toContain("std-3");
  });
});
