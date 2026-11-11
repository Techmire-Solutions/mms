import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExamResult, User } from "@mms/shared";

const assertEligible = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../examinations/use-cases/examEligibilityGate.js", () => ({
  assertExamResultsEligible: assertEligible,
}));

const loadExamsByIds = vi.hoisted(() => vi.fn());
vi.mock("../examinations/use-cases/examinationsUseCases.js", () => ({
  examinationsUseCases: { loadExamsByIds },
}));

const loadExamStudentSections = vi.hoisted(() => vi.fn());
vi.mock("../examinations/repository/examEligibilityAdapter.js", () => ({
  examEligibilityRepository: { loadExamStudentSections },
}));

const assertExamScope = vi.hoisted(() => vi.fn(async () => undefined));
const assertAnyClassScope = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../sessions/use-cases/teacherSectionScope.js", () => ({
  assertTeacherExamScope: assertExamScope,
  assertTeacherAnyClassScope: assertAnyClassScope,
}));

import { runWithTenant } from "../lib/tenantContext.js";
import { authorizeAndStampExamResults } from "../examinations/use-cases/examResultsSubmission.js";

const TEACHER = { id: "u-teacher", role: "teacher" } as User;
const RESULTS = [
  { id: "r-1", examId: "ex-1", studentId: "s-1", marksObtained: 80 },
] as unknown as ExamResult[];

beforeEach(() => {
  vi.clearAllMocks();
  loadExamsByIds.mockResolvedValue([
    { id: "ex-1", name: "Midterm", date: "2026-03-10", classIds: ["cls-1"] },
  ]);
  loadExamStudentSections.mockResolvedValue([
    { examId: "ex-1", studentId: "s-1", classId: "cls-1", sectionId: "sec-a" },
  ]);
});

describe("authorizeAndStampExamResults", () => {
  it("stamps the actor and scopes by the student's exact section", async () => {
    const stamped = await runWithTenant("demo", () =>
      authorizeAndStampExamResults(TEACHER, RESULTS),
    );

    expect(stamped[0]?.markedBy).toBe("u-teacher");
    expect(assertEligible).toHaveBeenCalledWith(TEACHER, RESULTS);
    expect(assertExamScope).toHaveBeenCalledWith(TEACHER, "demo", [
      { classId: "cls-1", sectionId: "sec-a", onDate: "2026-03-10" },
    ]);
  });

  it("falls back to the class-level rule when the exam has no date", async () => {
    loadExamsByIds.mockResolvedValue([
      { id: "ex-1", name: "Midterm", date: null, classIds: ["cls-1"] },
    ]);

    await runWithTenant("demo", () => authorizeAndStampExamResults(TEACHER, RESULTS));

    expect(assertExamScope).not.toHaveBeenCalled();
    expect(assertAnyClassScope).toHaveBeenCalledWith(TEACHER, "demo", [
      [{ classId: "cls-1", date: "" }],
    ]);
  });

  it("stamps without touching scope when there is no request tenant", async () => {
    const stamped = await authorizeAndStampExamResults(TEACHER, RESULTS);
    expect(stamped[0]?.markedBy).toBe("u-teacher");
    expect(loadExamStudentSections).not.toHaveBeenCalled();
    expect(assertExamScope).not.toHaveBeenCalled();
  });
});
