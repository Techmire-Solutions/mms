import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@mms/shared";
import { assertTeacherSectionScope } from "../sessions/use-cases/teacherSectionScope.js";

/**
 * Section-level attendance scope.
 *
 * The class-level check passes when a teacher has *any* section assignment in the class, so a
 * Section-A teacher could mark Section-B students. These tests pin the exact-section rule and its
 * exemptions (coordinators and unsectioned classes).
 */

const mocks = vi.hoisted(() => ({
  findUntaughtClassDates: vi.fn(),
  findUnstaffedSectionDates: vi.fn(),
}));

vi.mock("../sessions/repository/sessionsAcademicRepositoryAdapter.js", () => ({
  sessionsAcademicRepository: {
    findUntaughtClassDates: mocks.findUntaughtClassDates,
    findUnstaffedSectionDates: mocks.findUnstaffedSectionDates,
  },
}));

const TEACHER = { id: "u-teacher", role: "teacher" } as unknown as User;
const COORDINATOR = { id: "u-coord", role: "admin" } as unknown as User;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUntaughtClassDates.mockResolvedValue([]);
  mocks.findUnstaffedSectionDates.mockResolvedValue([]);
});

describe("assertTeacherSectionScope", () => {
  it("passes a mark in a section the teacher is staffed on", async () => {
    await expect(
      assertTeacherSectionScope(TEACHER, "demo", [
        { classId: "cls-1", sectionId: "sec-a", onDate: "2026-03-02" },
      ]),
    ).resolves.toBeUndefined();
    expect(mocks.findUnstaffedSectionDates).toHaveBeenCalledWith("demo", "u-teacher", [
      { classId: "cls-1", sectionId: "sec-a", onDate: "2026-03-02" },
    ]);
  });

  it("refuses a mark in another section of the same class", async () => {
    mocks.findUnstaffedSectionDates.mockResolvedValue([
      { classId: "cls-1", sectionId: "sec-b", onDate: "2026-03-02" },
    ]);
    await expect(
      assertTeacherSectionScope(TEACHER, "demo", [
        { classId: "cls-1", sectionId: "sec-b", onDate: "2026-03-02" },
      ]),
    ).rejects.toMatchObject({ statusCode: 403, type: "forbidden" });
  });

  it("keeps the class-level rule too (teacher teaches no section of the class)", async () => {
    mocks.findUntaughtClassDates.mockResolvedValue([{ classId: "cls-9", onDate: "2026-03-02" }]);
    await expect(
      assertTeacherSectionScope(TEACHER, "demo", [
        { classId: "cls-9", sectionId: "sec-a", onDate: "2026-03-02" },
      ]),
    ).rejects.toMatchObject({ statusCode: 403 });
    // Short-circuits before the section lookup.
    expect(mocks.findUnstaffedSectionDates).not.toHaveBeenCalled();
  });

  it("does not apply the section rule to unsectioned classes", async () => {
    await expect(
      assertTeacherSectionScope(TEACHER, "demo", [
        { classId: "cls-1", sectionId: null, onDate: "2026-03-02" },
      ]),
    ).resolves.toBeUndefined();
    expect(mocks.findUnstaffedSectionDates).not.toHaveBeenCalled();
  });

  it("leaves unscoped staff (no faculty link) alone", async () => {
    mocks.findUntaughtClassDates.mockResolvedValue(null);
    await expect(
      assertTeacherSectionScope(TEACHER, "demo", [
        { classId: "cls-1", sectionId: "sec-b", onDate: "2026-03-02" },
      ]),
    ).resolves.toBeUndefined();
  });

  it("exempts coordinators (sessions.delete) entirely", async () => {
    await expect(
      assertTeacherSectionScope(COORDINATOR, "demo", [
        { classId: "cls-1", sectionId: "sec-b", onDate: "2026-03-02" },
      ]),
    ).resolves.toBeUndefined();
    expect(mocks.findUntaughtClassDates).not.toHaveBeenCalled();
    expect(mocks.findUnstaffedSectionDates).not.toHaveBeenCalled();
  });
});
