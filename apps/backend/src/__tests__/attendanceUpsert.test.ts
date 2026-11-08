import { describe, it, expect } from "vitest";
import { planAttendanceUpsert } from "../db/repositories/attendanceUpsert.js";
import { ValidationError } from "../lib/httpErrors.js";
import type { AttendanceRecord } from "@mms/shared";

/**
 * The rules that keep concurrent roster saves safe are pure functions, so they are pinned here
 * without a database (the real-Postgres suite covers the SQL side).
 */

function record(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: "att-1",
    classId: "class-a",
    studentId: "student-1",
    studentName: "Student",
    rollNo: "",
    date: "2026-03-02",
    status: "present",
    timeIn: "",
    timeOut: "",
    notes: "",
    ...overrides,
  } as AttendanceRecord;
}

describe("planAttendanceUpsert", () => {
  it("collapses repeated business keys, keeping the last row the grid sent", () => {
    const plan = planAttendanceUpsert([
      record({ id: "att-a", status: "absent" }),
      record({ id: "att-b", status: "late" }),
    ]);

    expect(plan.withoutToken).toHaveLength(1);
    expect(plan.withoutToken[0]?.status).toBe("late");
    expect(plan.withToken).toHaveLength(0);
  });

  it("orders rows by business key so concurrent saves take locks in the same order", () => {
    const plan = planAttendanceUpsert([
      record({ id: "att-c", studentId: "student-3", date: "2026-03-02" }),
      record({ id: "att-a", studentId: "student-1", date: "2026-03-02" }),
      record({ id: "att-b", studentId: "student-2", date: "2026-03-02" }),
    ]);

    expect(plan.withoutToken.map((row) => row.studentId)).toEqual([
      "student-1",
      "student-2",
      "student-3",
    ]);
  });

  it("produces a deterministic order regardless of the request order", () => {
    const forward = planAttendanceUpsert([
      record({ id: "att-1", studentId: "student-1" }),
      record({ id: "att-2", studentId: "student-2" }),
    ]);
    const reverse = planAttendanceUpsert([
      record({ id: "att-2", studentId: "student-2" }),
      record({ id: "att-1", studentId: "student-1" }),
    ]);

    expect(forward.withoutToken.map((row) => row.id)).toEqual(
      reverse.withoutToken.map((row) => row.id),
    );
  });

  it("splits rows that carry an OCC token from legacy rows without one", () => {
    const plan = planAttendanceUpsert([
      record({ id: "att-tokened", version: 4 }),
      record({ id: "att-legacy", studentId: "student-2" }),
    ]);

    expect(plan.withToken.map((row) => row.id)).toEqual(["att-tokened"]);
    expect(plan.withoutToken.map((row) => row.id)).toEqual(["att-legacy"]);
  });

  it("generates an id for rows that arrive without one", () => {
    let n = 0;
    const plan = planAttendanceUpsert([record({ id: "" })], () => `att-gen-${++n}`);

    expect(plan.withoutToken[0]?.id).toBe("att-gen-1");
  });

  it("rejects one id reused for two different student/day keys", () => {
    expect(() =>
      planAttendanceUpsert([
        record({ id: "att-shared", studentId: "student-1" }),
        record({ id: "att-shared", studentId: "student-2" }),
      ]),
    ).toThrow(ValidationError);
  });
});
