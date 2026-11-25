import { describe, expect, it, vi } from "vitest";
import { SessionSchema } from "@mms/contracts";
import { sessionCompletionUseCases } from "../use-cases/sessionCompletionUseCases.js";

const hooks = vi.hoisted(() => ({
  runAfterCommit: vi.fn(),
  broadcastCollection: vi.fn(),
  invalidateMultiTierCache: vi.fn(),
  workspaceToday: vi.fn(),
  findSessionById: vi.fn(),
  loadSessionCompletionFacts: vi.fn(),
  loadCompletionGates: vi.fn(),
  markCertificatesIssued: vi.fn(),
}));

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenant: vi.fn((_tenant: string, cb: (tx: unknown) => Promise<unknown>) => cb({})),
}));
vi.mock("@mms/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/client")>()),

  runAfterCommit: hooks.runAfterCommit,
}));
vi.mock("@mms/be-core/realtime", () => ({ broadcastCollection: hooks.broadcastCollection }));
vi.mock("@mms/be-core/cache", () => ({
  invalidateMultiTierCache: hooks.invalidateMultiTierCache,
}));
vi.mock("../use-cases/sessionLockGuard.js", () => ({
  workspaceToday: hooks.workspaceToday,
}));
vi.mock("../repository/sessionsRepositoryAdapter.js", () => ({
  sessionsRepository: { findSessionById: hooks.findSessionById },
}));
vi.mock("../repository/sessionCompletionRepositoryAdapter.js", () => ({
  sessionCompletionRepository: {
    loadSessionCompletionFacts: hooks.loadSessionCompletionFacts,
    loadCompletionGates: hooks.loadCompletionGates,
    markCertificatesIssued: hooks.markCertificatesIssued,
  },
}));

describe("sessionCompletionUseCases", () => {
  it("defers broadcast and cache invalidation to runAfterCommit when certificates are issued", async () => {
    // Arrange
    hooks.runAfterCommit.mockImplementation((fn: () => unknown) => fn());
    hooks.workspaceToday.mockResolvedValue("2026-03-02");
    hooks.findSessionById.mockResolvedValue(
      SessionSchema.parse({
        id: "sess-1",
        name: "Done",
        status: "completed",
        endDate: "2026-03-01",
        minAttendancePct: 75,
      }),
    );
    hooks.loadSessionCompletionFacts.mockResolvedValue([]);
    hooks.loadCompletionGates.mockResolvedValue([]);
    hooks.markCertificatesIssued.mockResolvedValue(["e1"]);

    // Act
    const result = await sessionCompletionUseCases.issueCertificates("demo", "sess-1", {
      enrollmentIds: ["e1"],
    });

    // Assert
    expect(result.issued).toEqual(["e1"]);
    expect(hooks.runAfterCommit).toHaveBeenCalled();
    expect(hooks.broadcastCollection).toHaveBeenCalledWith("enrollments");
    expect(hooks.invalidateMultiTierCache).toHaveBeenCalled();
  });
});
