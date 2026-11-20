import { describe, expect, it, vi } from "vitest";
import { executeSessionRollover } from "../sessions/use-cases/sessionRolloverJob.js";

const hooks = vi.hoisted(() => ({
  findSessionByIdPrimary: vi.fn(),
  claimPromotionRun: vi.fn(),
  recordRunWarning: vi.fn(),
  findPromotedSourceIds: vi.fn(),
  setPromotionRunCounts: vi.fn(),
  readPromotionRunCounts: vi.fn(),
  updatePromotionRun: vi.fn(),
  listRolloverCandidates: vi.fn(),
  carryRolloverEnrollments: vi.fn(),
  bulkCloseRolloverSourceEnrollments: vi.fn(),
  closeRolloverSourceEnrollment: vi.fn(),
  ensureTarget: vi.fn(),
  planRollover: vi.fn(),
  rolloverTargetSection: vi.fn(),
  workspaceToday: vi.fn(),
  transitionSession: vi.fn(),
  recordModernAuditEvent: vi.fn(),
  invalidateMultiTierCache: vi.fn(),
  broadcastCollection: vi.fn(),
}));

vi.mock("../sessions/repository/sessionsRepositoryAdapter.js", () => ({
  sessionsRepository: { findSessionByIdPrimary: hooks.findSessionByIdPrimary },
}));
vi.mock("../sessions/repository/sessionRolloverRepositoryAdapter.js", () => ({
  sessionRolloverRepository: {
    claimPromotionRun: hooks.claimPromotionRun,
    findPromotionRun: vi.fn(),
    recordRunWarning: hooks.recordRunWarning,
    findPromotedSourceIds: hooks.findPromotedSourceIds,
    setPromotionRunCounts: hooks.setPromotionRunCounts,
    readPromotionRunCounts: hooks.readPromotionRunCounts,
    updatePromotionRun: hooks.updatePromotionRun,
  },
}));
vi.mock("../enrollments/use-cases/enrollmentRolloverUseCases.js", () => ({
  listRolloverCandidates: hooks.listRolloverCandidates,
  carryRolloverEnrollments: hooks.carryRolloverEnrollments,
  bulkCloseRolloverSourceEnrollments: hooks.bulkCloseRolloverSourceEnrollments,
}));
vi.mock("../sessions/use-cases/sessionRolloverTarget.js", () => ({
  ensureTarget: hooks.ensureTarget,
  deterministicRolloverId: (runId: string, kind: string, sourceId: string) =>
    `${runId}:${kind}:${sourceId}`,
}));
vi.mock("../sessions/use-cases/sessionRolloverPlan.js", () => ({
  planRollover: hooks.planRollover,
  rolloverTargetSection: hooks.rolloverTargetSection,
}));
vi.mock("../sessions/use-cases/sessionLockGuard.js", () => ({
  workspaceToday: hooks.workspaceToday,
}));
vi.mock("../sessions/use-cases/sessionTransitionService.js", () => ({
  transitionSession: hooks.transitionSession,
}));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: hooks.recordModernAuditEvent,
}));
vi.mock("../lib/cache/index.js", () => ({
  invalidateMultiTierCache: hooks.invalidateMultiTierCache,
}));
vi.mock("../lib/livePush.js", () => ({ broadcastCollection: hooks.broadcastCollection }));

const payload = {
  runId: "run-1",
  sourceSessionId: "src",
  body: { mode: "promote", closeSource: true, reason: "test" },
} as never;

describe("executeSessionRollover", () => {
  it("sets the outcome counter once from the full plan instead of per-student increments", async () => {
    // Arrange
    hooks.claimPromotionRun.mockResolvedValue(true);
    hooks.findSessionByIdPrimary.mockResolvedValue({
      id: "src",
      name: "Source",
      status: "in_progress",
      endDate: "2026-12-31",
      classes: [],
    });
    hooks.ensureTarget.mockResolvedValue({
      target: { id: "tgt", name: "Target", status: "draft" },
      ids: { classIds: new Map([["c1", "c1"]]), sectionIds: new Map() },
    });
    hooks.workspaceToday.mockResolvedValue("2026-12-31");
    hooks.listRolloverCandidates.mockResolvedValue([
      { id: "e1", studentId: "s1", studentName: "A", classId: "c1" },
      { id: "e2", studentId: "s2", studentName: "B", classId: "c1" },
    ]);
    hooks.planRollover.mockReturnValue([
      { enrollmentId: "e1", outcome: "promote", toClassId: "c1" },
      { enrollmentId: "e2", outcome: "retain", toClassId: "c1" },
    ]);
    hooks.rolloverTargetSection.mockReturnValue(null);
    // e1 was already carried by a prior attempt; e2 is carried now.
    hooks.findPromotedSourceIds.mockResolvedValue(new Set(["e1"]));
    hooks.carryRolloverEnrollments.mockResolvedValue({
      created: 1,
      carriedSourceIds: new Set(["e2"]),
    });
    hooks.bulkCloseRolloverSourceEnrollments.mockResolvedValue(undefined);
    hooks.setPromotionRunCounts.mockResolvedValue(undefined);
    hooks.readPromotionRunCounts.mockResolvedValue({
      promoted: 1,
      retained: 1,
      graduated: 0,
      left: 0,
    });
    hooks.updatePromotionRun.mockResolvedValue(undefined);
    hooks.transitionSession.mockResolvedValue({ session: {}, noop: false });
    hooks.recordModernAuditEvent.mockResolvedValue(undefined);
    hooks.invalidateMultiTierCache.mockResolvedValue(undefined);
    hooks.broadcastCollection.mockResolvedValue(undefined);

    // Act
    await executeSessionRollover("demo", "u-1", payload, async () => {}, {});

    // Assert
    expect(hooks.bulkCloseRolloverSourceEnrollments).toHaveBeenCalledTimes(1);
    expect(hooks.bulkCloseRolloverSourceEnrollments).toHaveBeenCalledWith(
      "demo",
      expect.arrayContaining([expect.objectContaining({ enrollmentId: "e2" })]),
      expect.objectContaining({ userId: "u-1" }),
    );
    expect(hooks.setPromotionRunCounts).toHaveBeenCalledTimes(1);
    expect(hooks.setPromotionRunCounts).toHaveBeenCalledWith("demo", "run-1", {
      promoted: 1,
      retained: 1,
      graduated: 0,
      left: 0,
    });
  });
});
