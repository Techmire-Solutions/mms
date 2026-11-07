import { describe, expect, it, vi } from "vitest";
import {
  assertSessionOverlapFree,
  loadSessionOverlapExemption,
} from "../sessions/use-cases/sessionOverlapGuard.js";
import { ConflictError } from "../lib/httpErrors.js";

const conflict = {
  id: "sess-old",
  name: "Hifz 2026",
  startDate: "2026-01-01",
  endDate: "2026-06-30",
  status: "in_progress",
};

function fakeRepo() {
  return { findOverlappingSessions: vi.fn().mockResolvedValue([conflict]) };
}

describe("assertSessionOverlapFree", () => {
  it("given an overlapping live session, should throw a 409 naming the conflict", async () => {
    // Arrange
    const repo = fakeRepo();

    // Act
    const act = () =>
      assertSessionOverlapFree(
        repo,
        "demo",
        { id: "sess-new", status: "draft", startDate: "2026-03-01", endDate: "2026-09-30" },
        false,
      );

    // Assert
    await expect(act()).rejects.toThrow(ConflictError);
    await expect(act()).rejects.toThrow("Hifz 2026");
    expect(repo.findOverlappingSessions).toHaveBeenCalledWith("demo", {
      startDate: "2026-03-01",
      endDate: "2026-09-30",
      excludeId: "sess-new",
    });
  });

  it("given the tenant allows overlapping sessions, should not query at all", async () => {
    // Arrange
    const repo = fakeRepo();

    // Act
    await assertSessionOverlapFree(
      repo,
      "demo",
      { id: "sess-new", status: "draft", startDate: "2026-03-01", endDate: "2026-09-30" },
      true,
    );

    // Assert
    expect(repo.findOverlappingSessions).not.toHaveBeenCalled();
  });

  it("given a row flagged overlap_exempt, should not query at all", async () => {
    // Arrange
    const repo = fakeRepo();

    // Act
    await assertSessionOverlapFree(
      repo,
      "demo",
      {
        id: "sess-new",
        status: "draft",
        startDate: "2026-03-01",
        endDate: "2026-09-30",
        overlapExempt: true,
      },
      false,
    );

    // Assert
    expect(repo.findOverlappingSessions).not.toHaveBeenCalled();
  });

  it("given a dateless session, should not query (no period, no possible conflict)", async () => {
    // Arrange
    const repo = fakeRepo();

    // Act
    await assertSessionOverlapFree(
      repo,
      "demo",
      { id: "sess-new", status: "draft", startDate: "", endDate: "" },
      false,
    );

    // Assert
    expect(repo.findOverlappingSessions).not.toHaveBeenCalled();
  });

  it("given a completed session, should not query (history may overlap)", async () => {
    // Arrange
    const repo = fakeRepo();

    // Act
    await assertSessionOverlapFree(
      repo,
      "demo",
      { id: "sess-new", status: "completed", startDate: "2026-03-01", endDate: "2026-09-30" },
      false,
    );

    // Assert
    expect(repo.findOverlappingSessions).not.toHaveBeenCalled();
  });

  it("given no overlap, should resolve", async () => {
    // Arrange
    const repo = { findOverlappingSessions: vi.fn().mockResolvedValue([]) };

    // Act / Assert
    await expect(
      assertSessionOverlapFree(
        repo,
        "demo",
        { id: "sess-new", status: "open", startDate: "2027-01-01", endDate: "2027-06-30" },
        false,
      ),
    ).resolves.toBeUndefined();
  });
});

describe("loadSessionOverlapExemption", () => {
  it("given the stored preference, should return its normalized allowOverlap", async () => {
    // Arrange
    const loadSessionPreferences = vi.fn().mockResolvedValue({ allowOverlap: true });

    // Act
    const result = await loadSessionOverlapExemption("demo", { loadSessionPreferences });

    // Assert
    expect(result).toBe(true);
    expect(loadSessionPreferences).toHaveBeenCalledWith("demo");
  });

  it("given no stored preferences, should fall back to the default (false)", async () => {
    // Act
    const result = await loadSessionOverlapExemption("demo", {
      loadSessionPreferences: () => null,
    });

    // Assert
    expect(result).toBe(false);
  });
});
