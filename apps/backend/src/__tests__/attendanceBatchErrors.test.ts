import { describe, expect, it } from "vitest";
import { AttendanceBatchRejectedError } from "../attendance/use-cases/attendanceBatchErrors.js";

/**
 * The rejection envelope itself: status/type, deduplicated violation codes, and the bounded row list
 * that reaches the client.
 */
describe("AttendanceBatchRejectedError", () => {
  const errors = [
    {
      index: 2,
      studentId: "std-2",
      date: "2026-03-02",
      code: "attendance_note_required",
      message: "Note required",
    },
    {
      index: 5,
      studentId: "std-5",
      date: "2026-03-03",
      code: "attendance_note_required",
      message: "Note required",
    },
    {
      index: 9,
      studentId: "std-9",
      date: "2026-03-04",
      code: "attendance_day_locked",
      message: "Day locked",
    },
  ];

  it("is a 422 batch rejection carrying every row", () => {
    const error = new AttendanceBatchRejectedError(errors);
    expect(error.statusCode).toBe(422);
    expect(error.type).toBe("attendance_batch_rejected");
    expect((error.details as { errors: unknown[] }).errors).toHaveLength(3);
    expect((error.details as { rejectedCount: number }).rejectedCount).toBe(3);
  });

  it("deduplicates the violation codes and keeps the submitted row positions", () => {
    const error = new AttendanceBatchRejectedError(errors);
    expect(error.violations).toEqual(["attendance_note_required", "attendance_day_locked"]);
    expect(
      (error.details as { errors: Array<{ index: number }> }).errors.map((row) => row.index),
    ).toEqual([2, 5, 9]);
  });

  it("caps the payload at 50 rows but reports the full count", () => {
    const many = Array.from({ length: 80 }, (_, index) => ({
      index,
      studentId: `std-${index}`,
      date: "2026-03-02",
      code: "attendance_note_required",
      message: "Note required",
    }));
    const error = new AttendanceBatchRejectedError(many);
    expect((error.details as { errors: unknown[] }).errors).toHaveLength(50);
    expect((error.details as { rejectedCount: number }).rejectedCount).toBe(80);
    // The message stays short even when the payload is large.
    expect(error.message.length).toBeLessThan(400);
  });
});
