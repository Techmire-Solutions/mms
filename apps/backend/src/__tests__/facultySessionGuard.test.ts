import { describe, expect, it, vi } from "vitest";
import { facultyRepositoryFixture } from "./helpers/facultyRepositoryFixture.js";
import type { FacultyRepository } from "../faculty/repository/facultyRepository.js";

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
}));

vi.mock("../faculty/repository/facultyRepositoryAdapter.js", () => ({
  facultyRepository: {},
}));

vi.mock("../faculty/use-cases/facultyHydrateUseCases.js", () => ({
  hydrateFacultyFromContacts: vi.fn(),
}));

vi.mock("../db/repositories/facultyRepositorySubordinates.js", () => ({
  findDirectSupervisorsBatch: vi.fn().mockResolvedValue(new Map()),
}));

describe("isFacultyProfileDeletedForUser", () => {
  it("probes by linked tenant user id, not by faculty primary key", async () => {
    const { isFacultyProfileDeletedForUser } =
      await import("../faculty/use-cases/facultyLoadEntityUseCases.js");
    const repo: FacultyRepository = facultyRepositoryFixture();
    vi.mocked(repo.isDeletedByUserId).mockResolvedValue(true);

    await expect(isFacultyProfileDeletedForUser("user-1", repo)).resolves.toBe(true);
    expect(repo.isDeletedByUserId).toHaveBeenCalledWith("demo", "user-1");
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it("returns false for a live linked profile", async () => {
    const { isFacultyProfileDeletedForUser } =
      await import("../faculty/use-cases/facultyLoadEntityUseCases.js");
    const repo: FacultyRepository = facultyRepositoryFixture();
    vi.mocked(repo.isDeletedByUserId).mockResolvedValue(false);

    await expect(isFacultyProfileDeletedForUser("user-1", repo)).resolves.toBe(false);
  });
});
