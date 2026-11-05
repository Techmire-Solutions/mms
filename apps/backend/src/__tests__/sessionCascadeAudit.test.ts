import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const audit = vi.fn();
  const outbox = vi.fn();
  const sync = vi.fn();
  const tx = { select: vi.fn(), update: vi.fn() };
  return { audit, outbox, sync, tx };
});

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (_tenant: string, callback: (tx: unknown) => Promise<unknown>) => callback(h.tx),
}));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: (...args: unknown[]) => h.audit(...args),
}));
vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvents: (...args: unknown[]) => h.outbox(...args),
}));
vi.mock("../db/repositories/enrollmentSessionSync.js", () => ({
  syncEnrolledSessionsTx: (...args: unknown[]) => h.sync(...args),
}));

import {
  restoreSessionWithCascade,
  softDeleteSessionWithCascade,
} from "../db/repositories/sessionRepositoryCascade.js";

type OutboxEvent = { type: string; payload: { entityType: string; entityId: string } };

describe("session cascade audit + outbox", () => {
  beforeEach(() => {
    h.audit.mockClear();
    h.outbox.mockClear();
    h.sync.mockClear();
    h.tx.select.mockReset().mockReturnValue({
      from: () => ({ where: () => ({ for: async () => [{ id: "s1" }] }) }),
    });
    h.tx.update.mockReset().mockReturnValue({
      set: () => ({
        where: () => ({ returning: async () => [{ id: "e1" }, { id: "e2" }] }),
      }),
    });
  });

  it("audits the session and emits session + enrollment tombstones on soft delete", async () => {
    // Act
    const ok = await softDeleteSessionWithCascade("demo", "s1", "u-admin", "cleanup");

    // Assert
    expect(ok).toBe(true);
    expect(h.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tableName: "sessions",
        recordId: "s1",
        actionType: "DELETE",
        realUserId: "u-admin",
      }),
    );
    expect(h.outbox).toHaveBeenCalledTimes(1);
    const events = h.outbox.mock.calls[0][0] as OutboxEvent[];
    expect(
      events.map((event) => [event.type, event.payload.entityType, event.payload.entityId]),
    ).toEqual([
      ["entity.soft_deleted", "sessions", "s1"],
      ["entity.soft_deleted", "enrollments", "e1"],
      ["entity.soft_deleted", "enrollments", "e2"],
    ]);
  });

  it("audits the session and emits restore events on restore", async () => {
    // Act
    const ok = await restoreSessionWithCascade("demo", "s1", "u-admin");

    // Assert
    expect(ok).toBe(true);
    expect(h.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tableName: "sessions", recordId: "s1", actionType: "RESTORE" }),
    );
    const events = h.outbox.mock.calls[0][0] as OutboxEvent[];
    expect(events.map((event) => event.type)).toEqual([
      "entity.restored",
      "entity.restored",
      "entity.restored",
    ]);
  });
});
