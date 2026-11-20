import { describe, expect, it, vi } from "vitest";
import { SessionSchema } from "@mms/shared";
import { sectionOperationsUseCases } from "../sessions/use-cases/sectionOperationsUseCases.js";

const hooks = vi.hoisted(() => ({
  runAfterCommit: vi.fn(),
  broadcastCollection: vi.fn(),
  invalidateMultiTierCache: vi.fn(),
  recordModernAuditEvent: vi.fn(),
  workspaceToday: vi.fn(),
  loadSectionRoster: vi.fn(),
  findSessionById: vi.fn(),
  applySectionClose: vi.fn(),
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: vi.fn((_tenant: string, cb: (tx: unknown) => Promise<unknown>) => cb({})),
}));
vi.mock("../db/commitScope.js", () => ({
  runAfterCommit: hooks.runAfterCommit,
}));
vi.mock("../lib/livePush.js", () => ({ broadcastCollection: hooks.broadcastCollection }));
vi.mock("../lib/cache/index.js", () => ({
  invalidateMultiTierCache: hooks.invalidateMultiTierCache,
}));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: hooks.recordModernAuditEvent,
}));
vi.mock("../sessions/use-cases/sessionLockGuard.js", () => ({
  workspaceToday: hooks.workspaceToday,
}));
vi.mock("../sessions/repository/sessionsAcademicRepositoryAdapter.js", () => ({
  sessionsAcademicRepository: {
    loadSectionRoster: hooks.loadSectionRoster,
    findSessionById: hooks.findSessionById,
    applySectionClose: hooks.applySectionClose,
  },
}));

const user = { id: "u-1", email: "", name: "", role: "admin", workspaceSubdomain: "demo" };

describe("sectionOperationsUseCases", () => {
  it("defers broadcast and cache invalidation to runAfterCommit on close", async () => {
    // Arrange
    hooks.runAfterCommit.mockImplementation((fn: () => unknown) => fn());
    hooks.workspaceToday.mockResolvedValue("2026-03-02");
    hooks.loadSectionRoster.mockResolvedValue({
      section: { id: "sec-1", status: "active", sessionId: "sess-1", classId: "c1", capacity: 30 },
      enrollmentIds: [],
    });
    hooks.findSessionById.mockResolvedValue(
      SessionSchema.parse({ id: "sess-1", name: "Live", status: "open" }),
    );
    hooks.applySectionClose.mockResolvedValue(0);

    // Act
    await sectionOperationsUseCases.close(
      "demo",
      "sec-1",
      { effectiveOn: "2026-03-01", reason: "Term ended" },
      user,
    );

    // Assert
    expect(hooks.runAfterCommit).toHaveBeenCalled();
    expect(hooks.broadcastCollection).toHaveBeenCalledWith("sessions");
    expect(hooks.invalidateMultiTierCache).toHaveBeenCalled();
  });
});
