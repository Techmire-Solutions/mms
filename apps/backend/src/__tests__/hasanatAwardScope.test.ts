import { describe, expect, it, vi } from "vitest";
import {
  assertAwardScope,
  resolveAwardScopeBypass,
} from "../hasanat/use-cases/hasanatAwardScope.js";
import type { HasanatRepository } from "../hasanat/repository/hasanatRepository.js";

function scopeRepo(overrides: Partial<HasanatRepository> = {}): HasanatRepository {
  return {
    findFacultyIdForUser: vi.fn().mockResolvedValue("fac-1"),
    listClassIdsTaughtByFaculty: vi.fn().mockResolvedValue(["cls-1"]),
    filterStudentsInFacultyClasses: vi.fn().mockResolvedValue(["stu-1"]),
    findTenantUserRole: vi.fn().mockResolvedValue("teacher"),
    ...overrides,
  } as unknown as HasanatRepository;
}

const base = {
  tenant: "demo",
  actorUserId: "u-teacher",
  awardScope: "assigned_classes" as const,
};

describe("hasanat award scope", () => {
  it("does nothing in tenant mode", async () => {
    const repo = scopeRepo();
    await assertAwardScope({
      ...base,
      repo,
      awardScope: "tenant",
      bypass: false,
      classIds: ["cls-foreign"],
      studentIds: ["stu-foreign"],
    });
    expect(repo.findFacultyIdForUser).not.toHaveBeenCalled();
  });

  it("lets admins award anywhere without a lookup", async () => {
    const repo = scopeRepo();
    await assertAwardScope({
      ...base,
      repo,
      bypass: true,
      classIds: ["cls-foreign"],
      studentIds: ["stu-foreign"],
    });
    expect(repo.findFacultyIdForUser).not.toHaveBeenCalled();
  });

  it("rejects a user with no staff record", async () => {
    const repo = scopeRepo({ findFacultyIdForUser: vi.fn().mockResolvedValue(null) });
    await expect(
      assertAwardScope({ ...base, repo, bypass: false, classIds: ["cls-1"] }),
    ).rejects.toMatchObject({
      statusCode: 403,
      type: "award_out_of_scope",
      details: { reason: "no_faculty_record" },
    });
  });

  it("rejects a class the instructor does not teach", async () => {
    const repo = scopeRepo();
    await expect(
      assertAwardScope({
        ...base,
        repo,
        bypass: false,
        classIds: ["cls-foreign"],
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      type: "award_out_of_scope",
      details: { classIds: ["cls-foreign"] },
    });
  });

  it("rejects a student outside the instructor's classes", async () => {
    const repo = scopeRepo();
    await expect(
      assertAwardScope({
        ...base,
        repo,
        bypass: false,
        studentIds: ["stu-1", "stu-foreign"],
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { studentIds: ["stu-foreign"] },
    });
  });

  it("accepts an in-scope class and student", async () => {
    const repo = scopeRepo();
    await expect(
      assertAwardScope({
        ...base,
        repo,
        bypass: false,
        classIds: ["cls-1"],
        studentIds: ["stu-1"],
      }),
    ).resolves.toBeUndefined();
  });

  it("derives the job bypass from the enqueuer's role", async () => {
    const principalRole = { findTenantUserRole: vi.fn().mockResolvedValue("principal") };
    await expect(resolveAwardScopeBypass("demo", "u1", scopeRepo(principalRole))).resolves.toBe(
      true,
    );

    const teacherRole = { findTenantUserRole: vi.fn().mockResolvedValue("teacher") };
    await expect(resolveAwardScopeBypass("demo", "u2", scopeRepo(teacherRole))).resolves.toBe(
      false,
    );
  });
});
