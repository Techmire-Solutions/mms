import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Student } from "@mms/shared";

const { canDeleteCollection, recordRestoreEvents, restoreCascaded } = vi.hoisted(() => ({
  canDeleteCollection: vi.fn(),
  recordRestoreEvents: vi.fn(),
  restoreCascaded: vi.fn(),
}));

vi.mock("../lib/rbacCanHelpers.js", () => ({
  canDeleteCollection: (...args: unknown[]) => canDeleteCollection(...args),
}));
vi.mock("../db/database.js", () => ({ activeDb: () => ({}) }));
vi.mock("../db/repositories/studentEnrollmentCascade.js", () => ({
  restoreCascadedEnrollmentsForStudents: (...args: unknown[]) => restoreCascaded(...args),
}));
vi.mock("../contacts/systemTags/contactSystemTagUseCases.js", () => ({
  reconcileContactSystemTags: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../students/use-cases/studentAuditEvents.js", () => ({
  recordRestoreEvents: (...args: unknown[]) => recordRestoreEvents(...args),
}));

const { restoreArchivedStudentOnCreate } =
  await import("../students/use-cases/studentRestoreOnCreate.js");

const ARCHIVED = {
  id: "s-1",
  contactId: "c-1",
  grNumber: "GR-1",
  status: "active",
  deletedAt: "2026-01-01T00:00:00.000Z",
} as unknown as Student;

const USER = {
  id: "u-1",
  name: "Registrar",
  email: "registrar@example.test",
  role: "registrar",
  workspaceSubdomain: "demo",
};

function fakeRepo() {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findRegistrationConflict: vi.fn().mockResolvedValue(null),
    findActiveStudentIdOwners: vi.fn().mockResolvedValue(new Map()),
  };
}

describe("restoreArchivedStudentOnCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses to resurrect an archived student without delete permission", async () => {
    canDeleteCollection.mockReturnValue(false);

    await expect(
      restoreArchivedStudentOnCreate({
        tenant: "demo",
        archived: ARCHIVED,
        incoming: { id: "s-2", contactId: "c-1" } as never,
        user: USER as never,
        userId: USER.id,
        repo: fakeRepo() as never,
      }),
    ).rejects.toThrow("Restoring soft-deleted students requires delete permissions");
  });

  it("restores in place, cascades enrollments and writes restore events", async () => {
    canDeleteCollection.mockReturnValue(true);
    const repo = fakeRepo();

    const restored = await restoreArchivedStudentOnCreate({
      tenant: "demo",
      archived: ARCHIVED,
      incoming: { id: "s-2", contactId: "c-1", notes: "re-registered" } as never,
      user: USER as never,
      userId: USER.id,
      repo: repo as never,
    });

    expect(restored.id).toBe("s-1");
    expect(repo.save).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ id: "s-1", notes: "re-registered" }),
    );
    expect(restoreCascaded).toHaveBeenCalledWith(
      expect.anything(),
      "demo",
      ["s-1"],
      USER.id,
      expect.any(Date),
    );
    expect(recordRestoreEvents).toHaveBeenCalled();
  });

  it("rejects a restore that would collide with an active GR number", async () => {
    canDeleteCollection.mockReturnValue(true);
    const repo = fakeRepo();
    repo.findRegistrationConflict.mockResolvedValue("grNumber");

    await expect(
      restoreArchivedStudentOnCreate({
        tenant: "demo",
        archived: ARCHIVED,
        incoming: { id: "s-2", contactId: "c-1" } as never,
        user: USER as never,
        userId: USER.id,
        repo: repo as never,
      }),
    ).rejects.toMatchObject({ field: "grNumber" });
    expect(repo.save).not.toHaveBeenCalled();
  });
});
