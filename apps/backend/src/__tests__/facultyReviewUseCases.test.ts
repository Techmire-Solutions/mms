import { describe, expect, it, vi } from "vitest";
import { facultyRepositoryFixture } from "./helpers/facultyRepositoryFixture.js";
import { createFaculty } from "../faculty/use-cases/facultyWriteUseCases.js";
import { loadHierarchyTree } from "../faculty/use-cases/facultyLoadEntityUseCases.js";
import {
  softDeleteFacultyById,
  bulkSoftDeleteFaculty,
} from "../faculty/use-cases/facultySoftDeleteUseCases.js";
import { ConflictError } from "../lib/httpErrors.js";

vi.mock("../lib/tenantContext.js", () => ({ getRequestTenant: () => "demo" }));
vi.mock("../db/database.js", () => ({
  runInTransaction: (work: () => Promise<unknown>) => work(),
}));
vi.mock("../lib/livePush.js", () => ({ broadcastCollection: vi.fn() }));
vi.mock("../faculty/use-cases/facultyWriteGuards.js", () => ({
  validateFacultyContactLink: vi.fn().mockResolvedValue({ userId: null }),
  validateFacultyDesignationLink: vi.fn().mockResolvedValue({ departmentId: "" }),
}));
vi.mock("../db/repositories/facultyAssignmentCascade.js", () => ({
  cascadeSoftDeleteFacultyAssignments: vi.fn().mockResolvedValue(0),
  cascadeRestoreFacultyAssignments: vi.fn().mockResolvedValue(0),
}));
vi.mock("../faculty/use-cases/facultyHydrateUseCases.js", () => ({
  hydrateFacultyFromContacts: (_tenant: string, rows: unknown[]) => Promise.resolve(rows),
}));
vi.mock("../db/repositories/facultyRepositorySubordinates.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../db/repositories/facultyRepositorySubordinates.js")>();
  return {
    ...actual,
    findDirectSupervisorsBatch: vi.fn(async (_tenant: string, ids: string[]) => {
      const map: Record<string, string> = {};
      for (const id of ids) {
        if (id === "0") map[id] = "149";
      }
      return map;
    }),
  };
});

describe("Faculty review regressions", () => {
  it.each([undefined, "2026-01-01T00:00:00.000Z"])(
    "given an existing ID (%s), rejects create without overwriting it",
    async (deletedAt) => {
      // Arrange
      const repo = facultyRepositoryFixture();
      vi.mocked(repo.findById).mockResolvedValue({
        id: "existing",
        contactId: "old-contact",
        status: "active",
        deletedAt,
      });
      // Act / Assert
      await expect(
        createFaculty(
          {
            id: "existing",
            contactId: "different-contact",
            employeeId: "EMP",
            designationId: "des-1",
          },
          repo,
          { canRestore: false },
        ),
      ).rejects.toThrow(ConflictError);
      expect(repo.save).not.toHaveBeenCalled();
    },
  );

  it("given a new ID, requests an insert that cannot overwrite a concurrent create", async () => {
    // Arrange
    const repo = facultyRepositoryFixture();
    // Act
    await createFaculty(
      { id: "new", contactId: "contact", employeeId: "EMP", designationId: "des-1" },
      repo,
    );
    // Assert
    expect(repo.save).toHaveBeenCalledWith("demo", expect.objectContaining({ id: "new" }), {
      createOnly: true,
    });
  });

  it("given 150 members, includes every page and preserves a supervisor on the second page", async () => {
    // Arrange
    const repo = facultyRepositoryFixture();
    const members = Array.from({ length: 150 }, (_, index) => ({
      id: String(index),
      contactId: `c-${index}`,
      status: "active",
      hierarchyRank: index === 149 ? 1 : 10,
      reportingFacultyId: index === 0 ? "149" : null,
    }));
    vi.mocked(repo.listPage).mockImplementation(async (_tenant, query) => {
      const page = query.page ?? 1;
      const limit = Math.min(query.limit ?? 50, 100);
      return {
        faculty: members.slice((page - 1) * limit, page * limit),
        total: 150,
        page,
        limit,
        hasMore: page * limit < 150,
      };
    });
    // Act
    const result = await loadHierarchyTree(repo);
    // Assert
    expect(result.nodes).toHaveLength(149);
    expect(
      result.nodes.find((node) => node.id === "149")?.subordinates.map((node) => node.id),
    ).toEqual(["0"]);
    expect(repo.listPage).toHaveBeenCalledTimes(2);
  });

  it.each(["single", "bulk"])(
    "given assignment dependents, blocks %s deletion before saving",
    async (mode) => {
      // Arrange
      const repo = facultyRepositoryFixture();
      vi.mocked(repo.guardAssignmentDependents).mockRejectedValue(
        new ConflictError("Reassign reporting assignments"),
      );
      // Act / Assert
      await expect(
        mode === "single"
          ? softDeleteFacultyById("manager", "actor", undefined, repo)
          : bulkSoftDeleteFaculty(["manager"], "actor", undefined, repo),
      ).rejects.toThrow(ConflictError);
      expect(repo.guardAssignmentDependents).toHaveBeenCalledWith("demo", ["manager"]);
      expect(repo.bulkSave).not.toHaveBeenCalled();
    },
  );
});
