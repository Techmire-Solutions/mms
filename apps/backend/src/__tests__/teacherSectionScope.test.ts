import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  isFacultyLinked: vi.fn(),
  findUntaughtClassDates: vi.fn(),
  findUnstaffedSectionDates: vi.fn(),
}));

vi.mock("../sessions/repository/sessionsAcademicRepositoryAdapter.js", () => ({
  sessionsAcademicRepository: repo,
}));

const { assertTeacherExamScope } = await import("../sessions/use-cases/teacherSectionScope.js");

const TEACHER = { id: "u-teacher", role: "teacher" } as never;
const ADMIN = { id: "u-admin", role: "admin" } as never;

const ENTRIES = [{ classId: "cls-1", sectionId: "sec-a", onDate: "2026-03-10" }];

beforeEach(() => {
  vi.clearAllMocks();
  repo.isFacultyLinked.mockResolvedValue(true);
  repo.findUntaughtClassDates.mockResolvedValue([]);
  repo.findUnstaffedSectionDates.mockResolvedValue([]);
});

describe("assertTeacherExamScope", () => {
  it("refuses a user with no faculty record (was silently unscoped)", async () => {
    repo.isFacultyLinked.mockResolvedValue(false);
    await expect(assertTeacherExamScope(TEACHER, "demo", ENTRIES)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(repo.findUntaughtClassDates).not.toHaveBeenCalled();
  });

  it("accepts a faculty-linked teacher staffed on that exact section", async () => {
    await expect(assertTeacherExamScope(TEACHER, "demo", ENTRIES)).resolves.toBeUndefined();
    expect(repo.findUnstaffedSectionDates).toHaveBeenCalledWith("demo", "u-teacher", ENTRIES);
  });

  it("refuses a teacher staffed on the class but not the section", async () => {
    repo.findUnstaffedSectionDates.mockResolvedValue(ENTRIES);
    await expect(assertTeacherExamScope(TEACHER, "demo", ENTRIES)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/sections/),
    });
  });

  it("keeps the coordinator bypass for admins (no faculty record needed)", async () => {
    repo.isFacultyLinked.mockResolvedValue(false);
    await expect(assertTeacherExamScope(ADMIN, "demo", ENTRIES)).resolves.toBeUndefined();
  });

  it("does nothing when there is nothing to scope", async () => {
    await expect(assertTeacherExamScope(TEACHER, "demo", [])).resolves.toBeUndefined();
    expect(repo.isFacultyLinked).not.toHaveBeenCalled();
  });
});
