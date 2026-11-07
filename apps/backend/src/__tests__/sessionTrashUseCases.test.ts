import { describe, expect, it, vi } from "vitest";
import { SessionSchema } from "@mms/shared";
import { createSessionTrashUseCases } from "../sessions/use-cases/sessionTrashUseCases.js";
import { transitionSession } from "../sessions/use-cases/sessionTransitionService.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { ConflictError } from "../lib/httpErrors.js";
import type { SessionsRepository } from "../sessions/repository/sessionsRepository.js";

vi.mock("../sessions/use-cases/sessionTransitionService.js", () => ({
  transitionSession: vi.fn(),
}));

function fakeRepo(overrides: Partial<SessionsRepository> = {}): SessionsRepository {
  return {
    findSessionById: vi.fn().mockResolvedValue(null),
    findSessionStatusesByIds: vi.fn().mockResolvedValue(new Map()),
    saveSession: vi.fn(),
    softDeleteSessionWithCascade: vi.fn().mockResolvedValue(true),
    restoreSessionWithCascade: vi.fn().mockResolvedValue(true),
    bulkSoftDeleteSessionsWithCascade: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
    bulkRestoreSessionsWithCascade: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
    ...overrides,
  } as unknown as SessionsRepository;
}

describe("session trash use-cases", () => {
  it("refuses to trash a session that has not reached a terminal state", async () => {
    // Arrange
    const repo = fakeRepo({
      findSessionById: vi
        .fn()
        .mockResolvedValue(SessionSchema.parse({ id: "s1", name: "Live", status: "in_progress" })),
    });
    const trash = createSessionTrashUseCases(repo);

    // Act
    const act = () => runWithTenant("demo", () => trash.deleteSessionById("s1", "u-1", "Oops"));

    // Assert
    await expect(act()).rejects.toBeInstanceOf(ConflictError);
    expect(repo.softDeleteSessionWithCascade).not.toHaveBeenCalled();
  });

  it("trashes a terminal session and restores through the repository", async () => {
    // Arrange
    const repo = fakeRepo({
      findSessionById: vi
        .fn()
        .mockResolvedValue(SessionSchema.parse({ id: "s1", name: "Done", status: "completed" })),
    });
    const trash = createSessionTrashUseCases(repo);

    // Act
    const removed = await runWithTenant("demo", () =>
      trash.deleteSessionById("s1", "u-1", "Session finished"),
    );
    const restored = await runWithTenant("demo", () => trash.restoreSessionById("s1", "u-1"));

    // Assert
    expect(removed).toBe(true);
    expect(restored).toBe(true);
    expect(repo.softDeleteSessionWithCascade).toHaveBeenCalledWith(
      "demo",
      "s1",
      "u-1",
      "Session finished",
    );
    expect(repo.restoreSessionWithCascade).toHaveBeenCalledWith("demo", "s1", "u-1");
  });

  it("routes each bulk status item through the transition service and counts failures", async () => {
    // Arrange
    const repo = fakeRepo({
      findSessionStatusesByIds: vi
        .fn()
        .mockResolvedValue(
          new Map([
            ["s1", "open"],
            ["s2", "archived"],
          ]),
        ),
    });
    vi.mocked(transitionSession).mockResolvedValue({
      session: SessionSchema.parse({ id: "s1", name: "One", status: "in_progress" }),
      ended: 0,
      billing: null,
      overridden: [],
      noop: false,
    });
    const trash = createSessionTrashUseCases(repo);

    // Act
    const result = await runWithTenant("demo", () =>
      trash.bulkUpdateSessionsStatus(["s1", "s2"], "in_progress"),
    );

    // Assert
    expect(result).toEqual({ succeeded: 1, failed: 1 });
    expect(transitionSession).toHaveBeenCalledTimes(1);
    expect(transitionSession).toHaveBeenCalledWith(
      "demo",
      "s1",
      expect.objectContaining({ to: "in_progress" }),
    );
  });
});
