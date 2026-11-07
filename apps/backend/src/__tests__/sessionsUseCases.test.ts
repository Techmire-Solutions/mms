import { describe, expect, it, vi } from "vitest";
import { createSessionsUseCases } from "../sessions/use-cases/sessionsUseCases.js";
import { transitionSession } from "../sessions/use-cases/sessionTransitionService.js";
import type { SessionsRepository } from "../sessions/repository/sessionsRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { ConflictError, NotFoundError } from "../lib/httpErrors.js";
import { SessionSchema } from "@mms/shared";

vi.mock("../sessions/use-cases/sessionTransitionService.js", () => ({
  transitionSession: vi.fn(),
}));

function createFakeRepo(): SessionsRepository {
  return {
    listSessionsByWorkspace: vi.fn().mockResolvedValue([]),
    findSessionById: vi.fn().mockResolvedValue(null),
    findSessionByIdPrimary: vi.fn().mockResolvedValue(null),
    findSessionsByIds: vi.fn().mockResolvedValue([]),
    findSessionStatusesByIds: vi.fn().mockResolvedValue(new Map()),
    findOverlappingSessions: vi.fn().mockResolvedValue([]),
    saveSession: vi.fn().mockResolvedValue("2026-01-02T00:00:00.000Z"),
    updateSessionDates: vi.fn().mockResolvedValue(true),
    listSessionsPage: vi.fn().mockResolvedValue({
      sessions: [],
      total: 0,
      page: 1,
      limit: 12,
      hasMore: false,
    }),
    countSessionsActive: vi.fn().mockResolvedValue(3),
    aggregateSessionsCommandMetrics: vi.fn().mockResolvedValue({
      total: 3,
      active: 2,
      upcoming: 1,
      completed: 0,
      cancelled: 0,
      totalEnrolled: 0,
      totalCapacity: 0,
      totalClasses: 0,
      sessionsThisWeek: 0,
      sessionsLastWeek: 0,
    }),
    bulkUpdateSessionsStatus: vi.fn().mockResolvedValue({ succeeded: 2, failed: 0 }),
    aggregateSessionsWidgetQueries: vi.fn().mockResolvedValue({}),
    loadSessionsReportAggregates: vi.fn().mockResolvedValue({
      capacity: [],
      enrollmentTrends: [],
      todaysSessions: [],
    }),
    softDeleteSessionWithCascade: vi.fn().mockResolvedValue(true),
    restoreSessionWithCascade: vi.fn().mockResolvedValue(true),
    bulkSoftDeleteSessionsWithCascade: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
    bulkRestoreSessionsWithCascade: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
  };
}

/** Preferences are injected so the use-cases never reach the database in a unit test. */
const createTestUseCases = (repo: SessionsRepository) =>
  createSessionsUseCases(repo, {
    loadSessionPreferences: () => ({ allowOverlap: false }),
  });

describe("sessions use-cases (DI with fake repository)", () => {
  it("countSessions delegates to the injected repository with the active tenant", async () => {
    const repo = createFakeRepo();
    const useCases = createTestUseCases(repo);

    const result = await runWithTenant("demo", () => useCases.countSessions());

    expect(result).toBe(3);
    expect(repo.countSessionsActive).toHaveBeenCalledWith("demo");
  });

  it("loadSessionsPage delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createTestUseCases(repo);

    const result = await runWithTenant("demo", () =>
      useCases.loadSessionsPage({ page: 2, limit: 12 }),
    );

    expect(result).toEqual({ sessions: [], total: 0, page: 1, limit: 12, hasMore: false });
    expect(repo.listSessionsPage).toHaveBeenCalledWith("demo", { page: 2, limit: 12 });
  });

  it("given mixed lifecycle states, should transition only the legal ones through the transition service", async () => {
    // Arrange
    const repo = createFakeRepo();
    vi.mocked(repo.findSessionStatusesByIds).mockResolvedValue(
      new Map([
        ["s1", "open"],
        ["s2", "completed"],
      ]),
    );
    vi.mocked(transitionSession).mockResolvedValue({
      session: SessionSchema.parse({ id: "s1", name: "One", status: "in_progress" }),
      ended: 0,
      billing: null,
      overridden: [],
      noop: false,
    });
    const useCases = createTestUseCases(repo);

    // Act
    const result = await runWithTenant("demo", () =>
      useCases.bulkUpdateSessionsStatus(["s1", "s2"], "active"),
    );

    // Assert
    expect(result).toEqual({ succeeded: 1, failed: 1 });
    expect(transitionSession).toHaveBeenCalledWith(
      "demo",
      "s1",
      expect.objectContaining({ to: "in_progress" }),
    );
  });

  it("createSession rejects a client id that already exists (active or archived)", async () => {
    // Arrange
    const repo = createFakeRepo();
    vi.mocked(repo.findSessionById).mockResolvedValue(
      SessionSchema.parse({ id: "sess-existing", name: "Existing", status: "completed" }) as never,
    );
    const useCases = createTestUseCases(repo);

    // Act
    const act = () =>
      runWithTenant("demo", () =>
        useCases.createSession({
          id: "sess-existing",
          name: "Overwrite attempt",
          status: "draft",
        } as never),
      );

    // Assert
    await expect(act()).rejects.toThrow(ConflictError);
    expect(repo.saveSession).not.toHaveBeenCalled();
  });

  it("updateSessionById forwards the OCC token to the repository", async () => {
    // Arrange
    const repo = createFakeRepo();
    const before = SessionSchema.parse({
      id: "s1",
      name: "Hifz 2026",
      status: "draft",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(repo.findSessionById).mockResolvedValue(before as never);
    const useCases = createTestUseCases(repo);

    // Act
    const result = await runWithTenant("demo", () =>
      useCases.updateSessionById(
        "s1",
        { name: "Renamed" },
        { canOverrideLock: false, today: "2026-01-01" },
        "2026-01-01T00:00:00.000Z",
      ),
    );

    // Assert
    expect(result?.name).toBe("Renamed");
    expect(result?.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(repo.saveSession).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ id: "s1", name: "Renamed" }),
      { expectedUpdatedAt: "2026-01-01T00:00:00.000Z" },
    );
  });

  it("updateSessionById rejects a malformed OCC header before touching the repository", async () => {
    // Arrange
    const repo = createFakeRepo();
    const useCases = createTestUseCases(repo);

    // Act
    const act = () =>
      runWithTenant("demo", () =>
        useCases.updateSessionById(
          "s1",
          { name: "Renamed" },
          { canOverrideLock: false, today: "2026-01-01" },
          "not-a-date",
        ),
      );

    // Assert
    await expect(act()).rejects.toThrow("x-expected-updated-at must be an ISO-8601 UTC timestamp");
    expect(repo.findSessionById).not.toHaveBeenCalled();
  });

  it("loadSessionsByIds filters out soft-deleted sessions", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.findSessionsByIds).mockResolvedValue([
      { id: "s1", name: "Active Session" } as never,
      { id: "s2", name: "Deleted Session", deletedAt: "2026-07-27T00:00:00.000Z" } as never,
    ]);
    const useCases = createTestUseCases(repo);

    const result = await runWithTenant("demo", () => useCases.loadSessionsByIds(["s1", "s2"]));

    expect(result.map((s) => s.id)).toEqual(["s1"]);
  });

  it("returns empty defaults when no tenant context is bound", async () => {
    const repo = createFakeRepo();
    const useCases = createTestUseCases(repo);

    const count = await useCases.countSessions();
    const page = await useCases.loadSessionsPage({ page: 1, limit: 12 });

    expect(count).toBe(0);
    expect(page).toEqual({ sessions: [], total: 0, page: 1, limit: 12, hasMore: false });
    expect(repo.countSessionsActive).not.toHaveBeenCalled();
    expect(repo.listSessionsPage).not.toHaveBeenCalled();
  });

  it("deleteSessionById delegates cascade soft-delete for a terminal session", async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.findSessionById).mockResolvedValue(
      SessionSchema.parse({ id: "s1", name: "Done", status: "completed" }) as never,
    );
    const useCases = createTestUseCases(repo);

    const ok = await runWithTenant("demo", () =>
      useCases.deleteSessionById("s1", "u-admin", "Session finished"),
    );

    expect(ok).toBe(true);
    expect(repo.softDeleteSessionWithCascade).toHaveBeenCalledWith(
      "demo",
      "s1",
      "u-admin",
      "Session finished",
    );
  });

  it("restoreSessionById delegates cascade restore to the repository", async () => {
    const repo = createFakeRepo();
    const useCases = createTestUseCases(repo);

    const ok = await runWithTenant("demo", () => useCases.restoreSessionById("s1", "u-admin"));

    expect(ok).toBe(true);
    expect(repo.restoreSessionWithCascade).toHaveBeenCalledWith("demo", "s1", "u-admin");
  });

  it('deleteSessionById throws NotFoundError with "already archived" if session is already soft-deleted', async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.softDeleteSessionWithCascade).mockResolvedValue(false);
    vi.mocked(repo.findSessionById).mockResolvedValue({
      id: "s1",
      deletedAt: "2026-08-01T00:00:00.000Z",
    } as never);
    const useCases = createTestUseCases(repo);

    await expect(runWithTenant("demo", () => useCases.deleteSessionById("s1"))).rejects.toThrow(
      new NotFoundError("Session is already archived"),
    );
  });

  it('deleteSessionById throws NotFoundError with "not found" if session does not exist', async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.softDeleteSessionWithCascade).mockResolvedValue(false);
    vi.mocked(repo.findSessionById).mockResolvedValue(null);
    const useCases = createTestUseCases(repo);

    await expect(runWithTenant("demo", () => useCases.deleteSessionById("s1"))).rejects.toThrow(
      new NotFoundError("Session not found"),
    );
  });

  it('restoreSessionById throws NotFoundError with "already active" if session is not soft-deleted', async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.restoreSessionWithCascade).mockResolvedValue(false);
    vi.mocked(repo.findSessionById).mockResolvedValue({ id: "s1", deletedAt: null } as never);
    const useCases = createTestUseCases(repo);

    await expect(runWithTenant("demo", () => useCases.restoreSessionById("s1"))).rejects.toThrow(
      new NotFoundError("Session is already active"),
    );
  });

  it('restoreSessionById throws NotFoundError with "not found" if session does not exist', async () => {
    const repo = createFakeRepo();
    vi.mocked(repo.restoreSessionWithCascade).mockResolvedValue(false);
    vi.mocked(repo.findSessionById).mockResolvedValue(null);
    const useCases = createTestUseCases(repo);

    await expect(runWithTenant("demo", () => useCases.restoreSessionById("s1"))).rejects.toThrow(
      new NotFoundError("Session not found"),
    );
  });

  it("bulkSoftDeleteSessions delegates to bulkSoftDeleteSessionsWithCascade", async () => {
    const repo = createFakeRepo();
    const useCases = createTestUseCases(repo);

    const res = await runWithTenant("demo", () =>
      useCases.bulkSoftDeleteSessions(["s1", "s2"], "u-admin", "Batch archive"),
    );

    expect(res).toEqual({ succeeded: 1, failed: 0 });
    expect(repo.bulkSoftDeleteSessionsWithCascade).toHaveBeenCalledWith(
      "demo",
      ["s1", "s2"],
      "u-admin",
      "Batch archive",
    );
  });

  it("bulkRestoreSessions delegates to bulkRestoreSessionsWithCascade", async () => {
    const repo = createFakeRepo();
    const useCases = createTestUseCases(repo);

    const res = await runWithTenant("demo", () =>
      useCases.bulkRestoreSessions(["s1", "s2"], "u-admin"),
    );

    expect(res).toEqual({ succeeded: 1, failed: 0 });
    expect(repo.bulkRestoreSessionsWithCascade).toHaveBeenCalledWith(
      "demo",
      ["s1", "s2"],
      "u-admin",
    );
  });

  it("updateSessionById refuses an unconditional overwrite (no concurrency token)", async () => {
    // Arrange
    const repo = createFakeRepo();
    vi.mocked(repo.findSessionById).mockResolvedValue(
      SessionSchema.parse({ id: "s1", name: "Hifz 2026", status: "draft", version: 4 }) as never,
    );
    const useCases = createTestUseCases(repo);

    // Act
    const act = () =>
      runWithTenant("demo", () =>
        useCases.updateSessionById(
          "s1",
          { name: "Renamed" },
          {
            canOverrideLock: false,
            today: "2026-01-01",
          },
        ),
      );

    // Assert
    await expect(act()).rejects.toMatchObject({
      statusCode: 428,
      type: "precondition_required",
    });
    expect(repo.saveSession).not.toHaveBeenCalled();
  });

  it("updateSessionById forwards the monotonic version token to the repository", async () => {
    // Arrange
    const repo = createFakeRepo();
    vi.mocked(repo.findSessionById).mockResolvedValue(
      SessionSchema.parse({ id: "s1", name: "Hifz 2026", status: "draft", version: 4 }) as never,
    );
    const useCases = createTestUseCases(repo);

    // Act
    const result = await runWithTenant("demo", () =>
      useCases.updateSessionById(
        "s1",
        { name: "Renamed" },
        { canOverrideLock: false, today: "2026-01-01" },
        undefined,
        4,
      ),
    );

    // Assert
    expect(repo.saveSession).toHaveBeenCalledWith("demo", expect.objectContaining({ id: "s1" }), {
      expectedVersion: 4,
    });
    // The next save can use the returned token without re-reading.
    expect(result?.version).toBe(5);
  });

  it("createSession refuses an overlapping live session", async () => {
    // Arrange
    const repo = createFakeRepo();
    vi.mocked(repo.findOverlappingSessions).mockResolvedValue([
      {
        id: "sess-old",
        name: "Hifz 2026",
        startDate: "2026-01-01",
        endDate: "2026-06-30",
        status: "in_progress",
      },
    ]);
    const useCases = createTestUseCases(repo);

    // Act
    const act = () =>
      runWithTenant("demo", () =>
        useCases.createSession({
          id: "sess-new",
          name: "Summer 2026",
          status: "draft",
          startDate: "2026-03-01",
          endDate: "2026-09-30",
        } as never),
      );

    // Assert
    await expect(act()).rejects.toThrow(ConflictError);
    expect(repo.saveSession).not.toHaveBeenCalled();
  });
});
