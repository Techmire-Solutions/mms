import { describe, expect, it, vi } from "vitest";
import { transitionWorkshop } from "../workshops/use-cases/workshopLifecycleUseCases.js";
import {
  ConflictError,
  HttpDomainError,
  NotFoundError,
  ValidationError,
} from "../lib/httpErrors.js";

vi.mock("../db/tenant-context.js", () => ({
  withTenant: vi.fn(async (_tenant, fn) => fn({} as any)),
}));

vi.mock("../db/commitScope.js", () => ({
  runAfterCommit: vi.fn((fn) => fn()),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

const mockAdapter = vi.hoisted(() => ({
  lockWorkshopTx: vi.fn(),
  workshopToday: vi.fn().mockResolvedValue("2026-03-15"),
  countLiveParticipantsTx: vi.fn().mockResolvedValue(5),
  countCertificatesTx: vi.fn().mockResolvedValue(0),
  updateWorkshopStatusIfTx: vi.fn(),
  archiveWorkshopRegistrationsTx: vi.fn(),
  workshopRowToRecord: vi.fn((row) => ({ ...row })),
}));

vi.mock("../workshops/repository/workshopLifecycleRepositoryAdapter.js", () => mockAdapter);

describe("workshopLifecycleUseCases", () => {
  it("rejects unknown workshop status with ValidationError", async () => {
    await expect(
      transitionWorkshop(
        "alpha",
        "ws-1",
        { to: "invalid_status" as any },
        { id: "usr-1" },
        "2026-03-01T10:00:00.000Z",
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("requires x-expected-updated-at precondition token", async () => {
    await expect(
      transitionWorkshop("alpha", "ws-1", { to: "open" }, { id: "usr-1" }, null),
    ).rejects.toThrow(HttpDomainError);
  });

  it("validates x-expected-updated-at is an ISO UTC timestamp", async () => {
    await expect(
      transitionWorkshop("alpha", "ws-1", { to: "open" }, { id: "usr-1" }, "not-a-valid-date"),
    ).rejects.toThrow(ValidationError);
  });

  it("throws NotFoundError when workshop does not exist", async () => {
    mockAdapter.lockWorkshopTx.mockResolvedValueOnce(null);

    await expect(
      transitionWorkshop(
        "alpha",
        "ws-missing",
        { to: "open" },
        { id: "usr-1" },
        "2026-03-01T10:00:00.000Z",
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws ConflictError on OCC mismatch", async () => {
    mockAdapter.lockWorkshopTx.mockResolvedValueOnce({
      id: "ws-1",
      updatedAt: new Date("2026-03-02T12:00:00.000Z"),
      deletedAt: null,
      status: "draft",
    });

    await expect(
      transitionWorkshop(
        "alpha",
        "ws-1",
        { to: "open" },
        { id: "usr-1" },
        "2026-03-01T10:00:00.000Z",
      ),
    ).rejects.toThrow(ConflictError);
  });
});
