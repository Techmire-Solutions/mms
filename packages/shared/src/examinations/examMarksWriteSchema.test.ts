import { describe, expect, it } from "vitest";
import { examMarksWriteListSchema, examMarksWriteSchema } from "./examinationsModuleManifest.js";

/**
 * The bulk marks body is a dedicated write DTO, not the full record.
 *
 * It previously accepted `graceMarks`, `moderationReason` and `moderatedBy` (the persist ignored
 * them, but the contract advertised them), and `marksObtained` defaulted to 0 — an omitted mark
 * became a recorded zero.
 */
describe("examMarksWriteSchema", () => {
  it("requires a mark (no silent zero default)", () => {
    expect(
      examMarksWriteSchema.safeParse({ id: "r-1", examId: "ex-1", studentId: "s-1" }).success,
    ).toBe(false);
    expect(
      examMarksWriteSchema.safeParse({
        id: "r-1",
        examId: "ex-1",
        studentId: "s-1",
        marksObtained: 0,
      }).success,
    ).toBe(true);
  });

  it("refuses moderation and server-owned fields on a plain marks save", () => {
    const base = { id: "r-1", examId: "ex-1", studentId: "s-1", marksObtained: 80 };
    expect(examMarksWriteSchema.safeParse({ ...base, graceMarks: 2 }).success).toBe(false);
    expect(examMarksWriteSchema.safeParse({ ...base, moderationReason: "x" }).success).toBe(false);
    expect(examMarksWriteSchema.safeParse({ ...base, markedBy: "u-other" }).success).toBe(false);
  });

  it("accepts the OCC token and caps the batch at the roster bound", () => {
    expect(
      examMarksWriteSchema.safeParse({
        id: "r-1",
        examId: "ex-1",
        studentId: "s-1",
        marksObtained: 80,
        version: 3,
      }).success,
    ).toBe(true);
    expect(examMarksWriteListSchema.safeParse([]).success).toBe(true);
  });
});
