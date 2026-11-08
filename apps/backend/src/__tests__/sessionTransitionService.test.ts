import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionSchema, type Session } from "@mms/shared";
import { ConflictError, NotFoundError, ValidationError } from "../lib/httpErrors.js";
import { transitionSession } from "../sessions/use-cases/sessionTransitionService.js";
import { SessionTransitionBlockedError } from "../sessions/use-cases/sessionTransitionErrors.js";
import {
  countLiveEnrollmentsTx,
  countSessionAttendanceTx,
  countSessionExamResultsTx,
  lockSessionForTransitionTx,
  sessionHasBudgetTx,
  updateSessionStatusIfTx,
} from "../db/repositories/sessionTransitionRepository.js";
import { getSessionModulePreferencesByWorkspace } from "../db/repositories/sessionModulePreferencesRepository.js";
import { sessionsRepository } from "../sessions/repository/sessionsRepositoryAdapter.js";
import {
  completeLiveEnrollments,
  endLiveEnrollments,
} from "../enrollments/use-cases/enrollmentEndUseCases.js";
import { recordModernAuditEvent } from "../services/auditTrailService.js";
import { broadcastCollection } from "../lib/livePush.js";

vi.mock("../db/tenant-context.js", () => ({
  withTenant: vi.fn((_tenant: string, cb: (tx: unknown) => Promise<unknown>) => cb({})),
}));
vi.mock("../db/repositories/sessionTransitionRepository.js", () => ({
  lockSessionForTransitionTx: vi.fn(),
  updateSessionStatusIfTx: vi.fn(),
  countLiveEnrollmentsTx: vi.fn(),
  countSessionAttendanceTx: vi.fn(),
  countSessionExamResultsTx: vi.fn(),
  sessionHasBudgetTx: vi.fn(),
}));
vi.mock("../db/repositories/sessionModulePreferencesRepository.js", () => ({
  getSessionModulePreferencesByWorkspace: vi.fn().mockResolvedValue({}),
}));
vi.mock("../sessions/repository/sessionsRepositoryAdapter.js", () => ({
  sessionsRepository: { findSessionById: vi.fn() },
}));
vi.mock("../enrollments/use-cases/enrollmentEndUseCases.js", () => ({
  endLiveEnrollments: vi.fn(),
  completeLiveEnrollments: vi.fn(),
  SYSTEM_ACTOR: { userId: null, label: "System" },
}));
vi.mock("../services/auditTrailService.js", () => ({ recordModernAuditEvent: vi.fn() }));
vi.mock("../lib/cache/index.js", () => ({ invalidateMultiTierCache: vi.fn() }));
vi.mock("../lib/livePush.js", () => ({ broadcastCollection: vi.fn() }));
vi.mock("../db/commitScope.js", () => ({ runAfterCommit: (fn: () => unknown) => void fn() }));
vi.mock("../sessions/use-cases/sessionLockGuard.js", () => ({
  workspaceToday: vi.fn().mockResolvedValue("2026-06-15"),
}));

const OPEN_ROW = {
  id: "s1",
  status: "open",
  version: 3,
  updatedAt: new Date("2026-06-01T08:00:00.000Z"),
  startDate: "2026-06-01",
  endDate: "2026-06-30",
};

const sessionOf = (status: string, overrides: Partial<Session> = {}): Session =>
  SessionSchema.parse({ id: "s1", name: "Hifz 2026", status, ...overrides });

beforeEach(() => {
  vi.mocked(lockSessionForTransitionTx).mockResolvedValue({ ...OPEN_ROW });
  vi.mocked(updateSessionStatusIfTx).mockResolvedValue(true);
  vi.mocked(countLiveEnrollmentsTx).mockResolvedValue(0);
  vi.mocked(countSessionAttendanceTx).mockResolvedValue(0);
  vi.mocked(countSessionExamResultsTx).mockResolvedValue(0);
  vi.mocked(sessionHasBudgetTx).mockResolvedValue(false);
  vi.mocked(getSessionModulePreferencesByWorkspace).mockResolvedValue({});
  vi.mocked(sessionsRepository.findSessionById).mockResolvedValue(sessionOf("open"));
  vi.mocked(endLiveEnrollments).mockResolvedValue({
    ended: 2,
    billing: { cancelled: [{ id: "inv-1", invoiceNumber: "INV-1" }], review: [] },
  });
  vi.mocked(completeLiveEnrollments).mockResolvedValue({ ended: 2, completed: 2, cancelled: 0 });
});

describe("transitionSession guards", () => {
  it("rejects the illegal draft → in_progress jump", async () => {
    // Arrange
    vi.mocked(lockSessionForTransitionTx).mockResolvedValue({ ...OPEN_ROW, status: "draft" });

    // Act
    const act = () => transitionSession("demo", "s1", { to: "in_progress" });

    // Assert
    await expect(act()).rejects.toBeInstanceOf(SessionTransitionBlockedError);
    await expect(act()).rejects.toMatchObject({ violations: ["illegal_transition"] });
    expect(updateSessionStatusIfTx).not.toHaveBeenCalled();
  });

  it("refuses cancelling without a reason", async () => {
    // Act
    const act = () => transitionSession("demo", "s1", { to: "cancelled", reason: "no" });

    // Assert
    await expect(act()).rejects.toMatchObject({ violations: ["reason_required"] });
    expect(endLiveEnrollments).not.toHaveBeenCalled();
  });

  it("cancels with a reason: ends enrollments on the session's last day and audits it", async () => {
    // Arrange
    vi.mocked(lockSessionForTransitionTx).mockResolvedValue({ ...OPEN_ROW, endDate: "2026-06-10" });

    // Act
    const result = await transitionSession("demo", "s1", {
      to: "cancelled",
      reason: "Teacher unavailable",
      actor: { userId: "u-1", label: "Admin" },
      expectedVersion: 3,
    });

    // Assert
    expect(updateSessionStatusIfTx).toHaveBeenCalledWith({}, "demo", "s1", "open", "cancelled");
    expect(endLiveEnrollments).toHaveBeenCalledWith(
      "demo",
      { sessionIds: ["s1"] },
      expect.objectContaining({ status: "cancelled", lastDay: "2026-06-10" }),
    );
    expect(result.ended).toBe(2);
    expect(result.billing?.cancelled).toHaveLength(1);
    expect(recordModernAuditEvent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        newState: expect.objectContaining({ from: "open", to: "cancelled" }),
      }),
    );
    expect(broadcastCollection).toHaveBeenCalledWith("enrollments");
    expect(broadcastCollection).toHaveBeenCalledWith("sessions");
  });

  it("rejects a stale version, and a row that changed between lock and write", async () => {
    // Act
    const stale = () =>
      transitionSession("demo", "s1", {
        to: "cancelled",
        reason: "Teacher left",
        expectedVersion: 2,
      });

    // Assert
    await expect(stale()).rejects.toBeInstanceOf(ConflictError);

    // Arrange: the CAS write loses the row
    vi.mocked(updateSessionStatusIfTx).mockResolvedValueOnce(false);
    const changed = () =>
      transitionSession("demo", "s1", { to: "cancelled", reason: "Teacher left" });
    await expect(changed()).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses re-opening a session that already has enrollments", async () => {
    // Arrange
    vi.mocked(countLiveEnrollmentsTx).mockResolvedValue(4);

    // Act
    const act = () => transitionSession("demo", "s1", { to: "draft" });

    // Assert
    await expect(act()).rejects.toMatchObject({ violations: ["session_has_enrollments"] });
    expect(updateSessionStatusIfTx).not.toHaveBeenCalled();
  });

  it("requires a budget plan before opening when the tenant enables requireBudget", async () => {
    // Arrange
    vi.mocked(lockSessionForTransitionTx).mockResolvedValue({ ...OPEN_ROW, status: "draft" });
    vi.mocked(getSessionModulePreferencesByWorkspace).mockResolvedValue({ requireBudget: true });

    // Act
    const act = () => transitionSession("demo", "s1", { to: "open" });

    // Assert
    await expect(act()).rejects.toMatchObject({ violations: ["budget_required"] });
  });

  it("blocks an early completion but allows it with an authorized override", async () => {
    // Arrange
    vi.mocked(lockSessionForTransitionTx).mockResolvedValue({
      ...OPEN_ROW,
      status: "in_progress",
      endDate: "2026-07-31",
    });
    vi.mocked(sessionsRepository.findSessionById).mockResolvedValue(sessionOf("completed"));
    const early = () => transitionSession("demo", "s1", { to: "completed" });

    // Act / Assert
    await expect(early()).rejects.toMatchObject({ violations: ["completion_before_end_date"] });

    // Arrange: blocked again without an override permission
    const noPermission = () =>
      transitionSession("demo", "s1", {
        to: "completed",
        reason: "Ends early",
        canOverride: false,
      });
    await expect(noPermission()).rejects.toBeInstanceOf(SessionTransitionBlockedError);

    // Act: authorized override waives the violation and records it
    const overridden = await transitionSession("demo", "s1", {
      to: "completed",
      reason: "Cohort finished early",
      canOverride: true,
    });

    // Assert
    expect(overridden.overridden).toEqual(["completion_before_end_date"]);
    expect(completeLiveEnrollments).toHaveBeenCalledWith(
      "demo",
      "s1",
      "2026-07-31",
      expect.anything(),
    );
  });

  it("ends live enrollments when the session is completed", async () => {
    // Arrange
    vi.mocked(lockSessionForTransitionTx).mockResolvedValue({
      ...OPEN_ROW,
      status: "in_progress",
      endDate: "2026-06-01",
    });
    vi.mocked(sessionsRepository.findSessionById).mockResolvedValue(sessionOf("completed"));

    // Act
    const result = await transitionSession("demo", "s1", { to: "completed" });

    // Assert
    expect(completeLiveEnrollments).toHaveBeenCalledWith(
      "demo",
      "s1",
      "2026-06-01",
      expect.anything(),
    );
    expect(result.ended).toBe(2);
    expect(endLiveEnrollments).not.toHaveBeenCalled();
  });

  it("returns a no-op without writing when the target equals the current state", async () => {
    // Act
    const result = await transitionSession("demo", "s1", { to: "open" });

    // Assert
    expect(result.noop).toBe(true);
    expect(updateSessionStatusIfTx).not.toHaveBeenCalled();
    expect(recordModernAuditEvent).not.toHaveBeenCalled();
  });

  it("maps an unknown target status to a 400 and a missing session to 404", async () => {
    // Act / Assert
    await expect(transitionSession("demo", "s1", { to: "planning" })).rejects.toBeInstanceOf(
      ValidationError,
    );

    vi.mocked(lockSessionForTransitionTx).mockResolvedValue(null);
    await expect(
      transitionSession("demo", "s1", { to: "cancelled", reason: "x y" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
