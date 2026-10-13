import { describe, expect, it } from "vitest";
import { buildEnrollmentPayload } from "../lib/enrollmentWizardBuildPayload";

describe("buildEnrollmentPayload", () => {
  it("builds enrollment payload properly with default values", () => {
    const student = {
      id: "std-1",
      name: "Bilal Ahmad",
    } as any;

    const session = {
      id: "ses-1",
      name: "Spring 2025",
      baseFee: 150,
    } as any;

    const classInfo = {
      id: "cls-1",
      name: "Class 1A",
    } as any;

    const feeResult = {
      id: "standard",
      label: "Standard Fee",
      pct: 0,
      discountAmt: 0,
      finalFee: 150,
    } as any;

    const payload = buildEnrollmentPayload({
      student,
      session,
      classInfo,
      feeResult,
      notes: "Test notes",
      customFieldValues: { custom1: "val1" },
      t: ((k: string) => k) as any,
    });

    expect(payload.studentId).toBe("std-1");
    expect(payload.studentName).toBe("Bilal Ahmad");
    expect(payload.sessionId).toBe("ses-1");
    expect(payload.classId).toBe("cls-1");
    expect(payload.finalFee).toBe(150);
    expect(payload.notes).toBe("Test notes");
    expect(payload.status).toBe("pending");
  });
});
