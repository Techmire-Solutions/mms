import { describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "../lib/httpErrors.js";
import {
  buildMarksAuditDelta,
  examResultIdConflictError,
  examResultNaturalKey,
  examResultStaleWriteError,
  normalizeMarks,
  planExamResultUpsert,
  type StoredMark,
} from "../db/repositories/examResultUpsert.js";

function mark(
  overrides: Partial<{ id: string; examId: string; studentId: string; marks: number }> = {},
) {
  return {
    id: overrides.id ?? `er-${Math.random().toString(36).slice(2, 8)}`,
    examId: overrides.examId ?? "ex-1",
    studentId: overrides.studentId ?? "stu-1",
    marksObtained: overrides.marks ?? 80,
  };
}

const stored = (overrides: Partial<StoredMark> = {}): StoredMark => ({
  id: overrides.id ?? "er-existing",
  examId: overrides.examId ?? "ex-1",
  studentId: overrides.studentId ?? "stu-1",
  marksObtained: overrides.marksObtained ?? 70,
});

describe("exam result upsert planner", () => {
  it("keys marks by exam and student, not by the surrogate id", () => {
    expect(examResultNaturalKey({ examId: " ex-1 ", studentId: " stu-1 " })).toBe("ex-1|stu-1");
    expect(examResultNaturalKey({})).toBe("|");
  });

  it("dedupes by business key and keeps the last row", () => {
    const plan = planExamResultUpsert([
      mark({ id: "er-a", marks: 10 }),
      mark({ id: "er-b", marks: 20 }),
    ]);
    expect(plan.withoutToken).toHaveLength(1);
    expect(plan.withoutToken[0]?.marksObtained).toBe(20);
    expect(plan.withoutToken[0]?.id).toBe("er-b");
  });

  it("separates rows that carry an OCC token from legacy rows", () => {
    const plan = planExamResultUpsert([
      { ...mark({ studentId: "stu-1" }), version: 3 },
      mark({ studentId: "stu-2" }),
    ]);
    expect(plan.withToken.map((row) => row.studentId)).toEqual(["stu-1"]);
    expect(plan.withoutToken.map((row) => row.studentId)).toEqual(["stu-2"]);
  });

  it("orders the batch by business key so concurrent saves take locks in one order", () => {
    const plan = planExamResultUpsert([
      mark({ examId: "ex-2", studentId: "stu-1" }),
      mark({ examId: "ex-1", studentId: "stu-2" }),
      mark({ examId: "ex-1", studentId: "stu-1" }),
    ]);
    expect(plan.withoutToken.map((row) => examResultNaturalKey(row))).toEqual([
      "ex-1|stu-1",
      "ex-1|stu-2",
      "ex-2|stu-1",
    ]);
  });

  it("rejects one id used for two different marks", () => {
    expect(() =>
      planExamResultUpsert([
        mark({ id: "er-shared", studentId: "stu-1" }),
        mark({ id: "er-shared", studentId: "stu-2" }),
      ]),
    ).toThrow(ValidationError);
  });

  it("generates an id when the caller omits one", () => {
    const plan = planExamResultUpsert([{ ...mark(), id: "" }]);
    expect(plan.withoutToken[0]?.id).toMatch(/^er-/);
  });

  it("normalizes marks to the numeric(8,2) column scale", () => {
    expect(normalizeMarks(85.5)).toBe(85.5);
    expect(normalizeMarks(85.123)).toBe(85.12);
    // Halves round the way Postgres rounds the decimal text, not the binary double.
    expect(normalizeMarks("72.345")).toBe(72.35);
    expect(normalizeMarks(85.555)).toBe(85.56);
    // Sub-cent and near-ceiling decimals must land on the same 2dp the column stores.
    expect(normalizeMarks(0.005)).toBe(0.01);
    expect(normalizeMarks(99.995)).toBe(100);
    expect(normalizeMarks("0.004")).toBe(0);
    expect(normalizeMarks("999999.99")).toBe(999999.99);
    expect(() => normalizeMarks("999999.995")).toThrow(ValidationError);
    expect(normalizeMarks(0)).toBe(0);
    expect(() => normalizeMarks(-1)).toThrow(ValidationError);
    expect(() => normalizeMarks(Number.NaN)).toThrow(ValidationError);
    expect(() => normalizeMarks(Infinity)).toThrow(ValidationError);
    expect(() => normalizeMarks(1_000_000)).toThrow(ValidationError);
  });

  it("reports a stale write as 409 stale_write, not a 500", () => {
    const error = examResultStaleWriteError({ examId: "ex-1", studentId: "stu-1" });
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.statusCode).toBe(409);
    expect(error.type).toBe("stale_write");
  });

  it("reports an id collision as a conflict instead of leaking 23505", () => {
    expect(examResultIdConflictError("er-1").type).toBe("exam_result_id_conflict");
  });
});

describe("marks audit delta", () => {
  it("skips unchanged marks and reports real changes and first entries", () => {
    const before = [stored({ id: "er-1", studentId: "stu-1", marksObtained: 70 })];
    const delta = buildMarksAuditDelta(before, [
      { id: "er-1", examId: "ex-1", studentId: "stu-1", marksObtained: 70 },
      { id: "er-2", examId: "ex-1", studentId: "stu-2", marksObtained: 55 },
      { id: "er-3", examId: "ex-1", studentId: "stu-3", marksObtained: 91.5 },
    ]);

    expect(delta).toHaveLength(2);
    expect(delta[0]).toEqual({
      recordId: "er-2",
      examId: "ex-1",
      studentId: "stu-2",
      from: null,
      to: 55,
    });
    expect(delta[1]?.to).toBe(91.5);
  });

  it("records the previous score when a mark is corrected", () => {
    const before = [stored({ id: "er-1", studentId: "stu-1", marksObtained: 70 })];
    const delta = buildMarksAuditDelta(before, [
      { id: "er-1", examId: "ex-1", studentId: "stu-1", marksObtained: 74.25 },
    ]);
    expect(delta).toEqual([
      { recordId: "er-1", examId: "ex-1", studentId: "stu-1", from: 70, to: 74.25 },
    ]);
  });
});
