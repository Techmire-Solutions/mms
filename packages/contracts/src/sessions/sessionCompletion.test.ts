import { describe, expect, it } from "vitest";
import { completionGateViolations, evaluateCompletion } from "./sessionCompletion.js";

const facts = { attendancePct: 90, examsPassed: true, examsComplete: true };

describe("evaluateCompletion", () => {
  it("given no criteria, should complete every enrollment", () => {
    expect(
      evaluateCompletion({ attendancePct: null, examsPassed: null, examsComplete: false }, {}),
    ).toEqual({ status: "completed", shortfalls: [] });
  });

  it("given attendance under the minimum, should not complete", () => {
    expect(evaluateCompletion({ ...facts, attendancePct: 70 }, { minAttendancePct: 75 })).toEqual({
      status: "not_completed",
      shortfalls: ["attendance_below"],
    });
  });

  it("given no attendance marked, should flag the attendance as unknown", () => {
    expect(
      evaluateCompletion({ ...facts, attendancePct: null }, { minAttendancePct: 75 }).shortfalls,
    ).toEqual(["attendance_unknown"]);
  });

  it("given a required exam that was failed or not taken, should name the exam shortfall", () => {
    // Act
    const failed = evaluateCompletion({ ...facts, examsPassed: false }, { requiresExamPass: true });
    const missing = evaluateCompletion(
      { ...facts, examsComplete: false },
      { requiresExamPass: true },
    );
    const none = evaluateCompletion({ ...facts, examsPassed: null }, { requiresExamPass: true });

    // Assert
    expect(failed.shortfalls).toEqual(["exam_not_passed"]);
    expect(missing.shortfalls).toEqual(["exam_missing"]);
    expect(none.shortfalls).toEqual(["exam_missing"]);
  });

  describe("completionGateViolations", () => {
    it("given unmarked days and unfinalized exams, should name both finalisation gates", () => {
      expect(completionGateViolations({ unmarkedDays: 3, unfinalizedExams: 2 })).toEqual([
        "attendance_unfinalized",
        "exams_unfinalized",
      ]);
    });

    it("given no criteria, outstanding dues and stale evidence, should name each gate", () => {
      expect(
        completionGateViolations({
          criteriaConfigured: false,
          outstandingDues: 1500,
          evaluationStale: true,
        }),
      ).toEqual(["no_criteria", "outstanding_dues", "evaluation_stale"]);
    });

    it("given a fully finalised session, should report no violations", () => {
      expect(
        completionGateViolations({
          unmarkedDays: 0,
          unfinalizedExams: 0,
          criteriaConfigured: true,
          outstandingDues: 0,
          evaluationStale: false,
        }),
      ).toEqual([]);
    });
  });

  it("given every criterion met, should complete", () => {
    expect(evaluateCompletion(facts, { minAttendancePct: 75, requiresExamPass: true }).status).toBe(
      "completed",
    );
  });
});
