import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExamResult, User } from "@mms/contracts";

const assertEligible = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock(
  "../../../../packages/modules/examinations/dist/backend/use-cases/examEligibilityGate.js",
  () => ({
    assertExamResultsEligible: assertEligible,
  }),
);
vi.mock("@mms/mod-examinations/backend/use-cases", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/mod-examinations/backend/use-cases")>();
  return { ...actual, assertExamResultsEligible: assertEligible };
});

const findExamsByIds = vi.hoisted(() => vi.fn());
const loadExamStudentSections = vi.hoisted(() => vi.fn());
vi.mock("@mms/mod-examinations/backend/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-examinations/backend/repository")>()),
  examinationsRepository: { findExamsByIds },
  examEligibilityRepository: {
    loadExamStudentSections,
    loadExamEligibilityBatch: vi.fn().mockResolvedValue(new Map()),
  },
}));

const assertExamScope = vi.hoisted(() => vi.fn(async () => undefined));
const assertAnyClassScope = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@mms/mod-sessions/backend/use-cases", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-sessions/backend/use-cases")>()),
  assertTeacherExamScope: assertExamScope,
  assertTeacherAnyClassScope: assertAnyClassScope,
}));

import { configureExaminationsPorts } from "@mms/mod-examinations/backend/ports";
configureExaminationsPorts({
  teacherScope: {
    assertTeacherExamScope: assertExamScope as never,
    assertTeacherAnyClassScope: assertAnyClassScope as never,
    assertTeacherClassScope: vi.fn() as never,
    assertTeacherSectionScope: vi.fn() as never,
  },
} as never);

import { runWithTenant } from "@mms/be-core/http";
import { authorizeAndStampExamResults } from "@mms/mod-examinations/backend/use-cases";

const TEACHER = { id: "u-teacher", role: "teacher" } as User;
const RESULTS = [
  { id: "r-1", examId: "ex-1", studentId: "s-1", marksObtained: 80 },
] as unknown as ExamResult[];

beforeEach(() => {
  vi.clearAllMocks();
  findExamsByIds.mockResolvedValue([
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
    // One exam load is shared with the gate and the teacher-scope rule.
    expect(assertEligible).toHaveBeenCalledWith("demo", RESULTS, expect.any(Array));
    expect(findExamsByIds).toHaveBeenCalledTimes(1);
    expect(assertExamScope).toHaveBeenCalledWith(TEACHER, "demo", [
      { classId: "cls-1", sectionId: "sec-a", onDate: "2026-03-10" },
    ]);
  });

  it("falls back to the class-level rule when the exam has no date", async () => {
    findExamsByIds.mockResolvedValue([
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
