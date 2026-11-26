import { describe, expect, it, vi } from "vitest";
import type { SavedReportsRepository } from "../repository/savedReportsRepository.js";
import { savedReportsRepositoryAdapter } from "../repository/savedReportsRepositoryAdapter.js";
import { createSavedReportsUseCases, savedReportsUseCases } from "./savedReportsUseCases.js";

describe("savedReportsUseCases (@mms/mod-analytics)", () => {
  it("delegates all tenant- and owner-scoped saved-report operations to the injected repository", async () => {
    const sampleReport = {
      id: "rep-1",
      category: "students" as const,
      name: "Active Roster",
      filters: {},
      lastRunAt: "2026-11-26T00:00:00.000Z",
      createdBy: "user-1",
      createdByName: "Admin",
      createdAt: "2026-11-26T00:00:00.000Z",
      updatedAt: "2026-11-26T00:00:00.000Z",
    };

    const mockRepo: SavedReportsRepository = {
      listSavedReportsByOwner: vi.fn().mockResolvedValue([sampleReport]),
      createSavedReportForOwner: vi.fn().mockResolvedValue(sampleReport),
      deleteSavedReportByOwner: vi.fn().mockResolvedValue(true),
      touchSavedReportRunByOwner: vi.fn().mockResolvedValue(sampleReport),
    };

    const useCases = createSavedReportsUseCases(mockRepo);

    await expect(
      useCases.listSavedReportsByOwner("demo", "students", "user-1", { limit: 25, offset: 0 }),
    ).resolves.toEqual([sampleReport]);
    expect(mockRepo.listSavedReportsByOwner).toHaveBeenCalledWith("demo", "students", "user-1", {
      limit: 25,
      offset: 0,
    });

    const createPayload = {
      category: "students" as const,
      name: "Active Roster",
      filters: {},
      createdBy: "user-1",
      createdByName: "Admin",
    };
    await expect(useCases.createSavedReportForOwner("demo", createPayload)).resolves.toEqual(
      sampleReport,
    );
    expect(mockRepo.createSavedReportForOwner).toHaveBeenCalledWith("demo", createPayload);

    await expect(
      useCases.deleteSavedReportByOwner("demo", "rep-1", "students", "user-1"),
    ).resolves.toBe(true);
    expect(mockRepo.deleteSavedReportByOwner).toHaveBeenCalledWith(
      "demo",
      "rep-1",
      "students",
      "user-1",
    );

    await expect(
      useCases.touchSavedReportRunByOwner("demo", "rep-1", "students", "user-1"),
    ).resolves.toEqual(sampleReport);
    expect(mockRepo.touchSavedReportRunByOwner).toHaveBeenCalledWith(
      "demo",
      "rep-1",
      "students",
      "user-1",
    );
  });

  it("wires default savedReportsUseCases to savedReportsRepositoryAdapter", () => {
    expect(savedReportsUseCases.listSavedReportsByOwner).toBe(
      savedReportsRepositoryAdapter.listSavedReportsByOwner,
    );
    expect(savedReportsUseCases.createSavedReportForOwner).toBe(
      savedReportsRepositoryAdapter.createSavedReportForOwner,
    );
    expect(savedReportsUseCases.deleteSavedReportByOwner).toBe(
      savedReportsRepositoryAdapter.deleteSavedReportByOwner,
    );
    expect(savedReportsUseCases.touchSavedReportRunByOwner).toBe(
      savedReportsRepositoryAdapter.touchSavedReportRunByOwner,
    );
  });
});
