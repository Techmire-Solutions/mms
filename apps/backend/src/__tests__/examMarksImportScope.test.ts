import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@mms/shared";

const examinations = vi.hoisted(() => ({ findExamById: vi.fn() }));
vi.mock("../examinations/repository/examinationsRepositoryAdapter.js", () => ({
  examinationsRepository: examinations,
}));

const eligibility = vi.hoisted(() => ({ loadExamRoster: vi.fn() }));
vi.mock("../examinations/repository/examEligibilityAdapter.js", () => ({
  examEligibilityRepository: eligibility,
}));

const scope = vi.hoisted(() => ({
  assertTeacherExamScope: vi.fn(
    async (_user: unknown, _tenant: string, _entries: Array<Record<string, unknown>>) => undefined,
  ),
  assertTeacherAnyClassScope: vi.fn(
    async (_user: unknown, _tenant: string, _groups: Array<Array<Record<string, unknown>>>) =>
      undefined,
  ),
}));
vi.mock("../sessions/use-cases/teacherSectionScope.js", () => ({
  assertTeacherExamScope: scope.assertTeacherExamScope,
  assertTeacherAnyClassScope: scope.assertTeacherAnyClassScope,
}));

import { assertMarksImportScope } from "../examinations/use-cases/examMarksImportScope.js";

const TEACHER = { id: "u-teacher", role: "teacher" } as User;
const TENANT = "demo";
const EXAM = "ex-1";

beforeEach(() => {
  vi.clearAllMocks();
  examinations.findExamById.mockResolvedValue({ id: EXAM, date: "2026-03-10" });
  eligibility.loadExamRoster.mockResolvedValue([
    { studentId: "s-1", studentName: "A", rollNumber: "1", classId: "c-1", sectionId: "sec-a" },
    { studentId: "s-2", studentName: "B", rollNumber: "2", classId: "c-1", sectionId: "sec-a" },
    { studentId: "s-3", studentName: "C", rollNumber: "3", classId: "c-1", sectionId: "sec-b" },
  ]);
});

describe("marks-import teacher scope", () => {
  it("scopes the submitted rolls by their exact section on the exam date", async () => {
    await assertMarksImportScope(TEACHER, TENANT, EXAM, [
      { rollNumber: "1" },
      { rollNumber: "2" },
      { rollNumber: "3" },
    ]);

    expect(scope.assertTeacherExamScope).toHaveBeenCalledTimes(1);
    const entries = scope.assertTeacherExamScope.mock.calls[0]?.[2];
    expect(entries).toEqual([
      { classId: "c-1", sectionId: "sec-a", onDate: "2026-03-10" },
      { classId: "c-1", sectionId: "sec-b", onDate: "2026-03-10" },
    ]);
  });

  it("wraps a scope rejection in the import-specific 403", async () => {
    scope.assertTeacherExamScope.mockRejectedValueOnce(
      Object.assign(new Error("You are not staffed on this section"), { statusCode: 403 }),
    );

    await expect(
      assertMarksImportScope(TEACHER, TENANT, EXAM, [{ rollNumber: "1" }]),
    ).rejects.toMatchObject({
      statusCode: 403,
      type: "exam_marks_import_forbidden",
      details: { examId: EXAM },
    });
  });

  it("falls back to the class-level rule for an undated exam", async () => {
    examinations.findExamById.mockResolvedValue({ id: EXAM, date: null });

    await assertMarksImportScope(TEACHER, TENANT, EXAM, [{ rollNumber: "1" }]);

    expect(scope.assertTeacherExamScope).not.toHaveBeenCalled();
    expect(scope.assertTeacherAnyClassScope).toHaveBeenCalledWith(TEACHER, TENANT, [
      [{ classId: "c-1", date: "" }],
    ]);
  });

  it("ignores unknown and ambiguous rolls instead of widening scope", async () => {
    eligibility.loadExamRoster.mockResolvedValue([
      { studentId: "s-1", studentName: "A", rollNumber: "1", classId: "c-1", sectionId: "sec-a" },
      { studentId: "s-2", studentName: "B", rollNumber: "1", classId: "c-1", sectionId: "sec-b" },
    ]);

    await assertMarksImportScope(TEACHER, TENANT, EXAM, [
      { rollNumber: "1" }, // ambiguous
      { rollNumber: "404" }, // unknown
    ]);
    expect(scope.assertTeacherExamScope).not.toHaveBeenCalled();
    expect(scope.assertTeacherAnyClassScope).not.toHaveBeenCalled();
  });

  it("does no scope work for an empty batch or a missing exam", async () => {
    await assertMarksImportScope(TEACHER, TENANT, EXAM, []);
    examinations.findExamById.mockResolvedValue(null);
    await assertMarksImportScope(TEACHER, TENANT, EXAM, [{ rollNumber: "1" }]);
    expect(eligibility.loadExamRoster).not.toHaveBeenCalled();
    expect(scope.assertTeacherExamScope).not.toHaveBeenCalled();
  });
});
