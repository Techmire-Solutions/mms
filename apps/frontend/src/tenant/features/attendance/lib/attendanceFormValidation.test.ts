import { describe, expect, it } from "vitest";
import { attendanceLeaveInsertSchema } from "@mms/shared";
import { serverFormError, validateAttendanceDraft } from "./attendanceFormValidation";

describe("validateAttendanceDraft", () => {
  it("returns the shared schema's field errors instead of a generic message", () => {
    const result = validateAttendanceDraft(
      attendanceLeaveInsertSchema,
      {
        studentId: "",
        fromDate: "2026-03-05",
        toDate: "2026-03-01",
        reason: "",
        leaveType: "medical",
      },
      (message) => message,
    );

    expect(result.ok).toBe(false);
    expect(result.fieldErrors.studentId).toBe("Student is required");
    expect(result.fieldErrors.reason).toBe("Reason is required");
    expect(result.fieldErrors.toDate).toContain("before");
    expect(result.message).toBe("Student is required");
  });

  it("accepts a valid draft and returns the parsed record", () => {
    const result = validateAttendanceDraft(
      attendanceLeaveInsertSchema,
      {
        studentId: "std-1",
        fromDate: "2026-03-01",
        toDate: "2026-03-02",
        reason: "Fever",
        leaveType: "medical",
      },
      (message) => message,
    );

    expect(result.ok).toBe(true);
    expect(result.data?.studentId).toBe("std-1");
  });
});

describe("serverFormError", () => {
  it("flattens a batch envelope onto row ids", () => {
    const mapped = serverFormError({
      message: "Attendance rejected",
      details: { errors: [{ studentId: "std-1", message: "On approved leave" }] },
    });
    expect(mapped.message).toBe("Attendance rejected");
    expect(mapped.fieldErrors["std-1"]).toBe("On approved leave");
  });

  it("falls back to the domain message", () => {
    expect(serverFormError({ message: "Half-day tracking is disabled" }).message).toBe(
      "Half-day tracking is disabled",
    );
  });
});
