import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObligationCollection } from "@mms/shared";

const mockAudit = vi.hoisted(() => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({}),
}));
const mockOutbox = vi.hoisted(() => ({
  emitOutboxEvents: vi.fn().mockResolvedValue(undefined),
}));
const mockActor = vi.hoisted(() => ({
  getRequestUserId: vi.fn((): string | null => "usr-accountant"),
}));

vi.mock("../services/auditTrailService.js", () => mockAudit);
vi.mock("../services/outboxEventService.js", () => mockOutbox);
vi.mock("../lib/tenantContext.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/tenantContext.js")>();
  return { ...actual, getRequestUserId: mockActor.getRequestUserId };
});

import {
  auditCatalogueReplaced,
  auditCollectionSaved,
  auditCollectionsDeleted,
  auditCollectionsRestored,
} from "../obligations/use-cases/obligationAuditTrail.js";

const TENANT = "demo";

function receipt(overrides: Partial<ObligationCollection> = {}): ObligationCollection {
  return {
    id: "oc-1",
    receipt_no: "REC-1",
    received_date: "2026-06-15",
    sender_id: "cnt-1",
    amount: 1500,
    currency_id: "PKR",
    payment_mode: "Cash",
    obligation_type_id: "ot-1",
    mujtahid_representative_id: "rep-1",
    received_by: "usr-1",
    ...overrides,
  } as ObligationCollection;
}

describe("obligation audit trail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActor.getRequestUserId.mockReturnValue("usr-accountant");
  });

  it("records a CREATE with the full new state and the actor", async () => {
    await auditCollectionSaved(TENANT, null, receipt());

    expect(mockAudit.recordModernAuditEvent).toHaveBeenCalledTimes(1);
    const input = mockAudit.recordModernAuditEvent.mock.calls[0][0];
    expect(input).toMatchObject({
      workspaceSubdomain: TENANT,
      tableName: "obligation_collections",
      recordId: "oc-1",
      actionType: "CREATE",
      realUserId: "usr-accountant",
    });
    expect(input.oldState).toBeUndefined();
    expect(input.newState).toMatchObject({ amount: 1500 });
  });

  it("records an UPDATE with a before/after diff of the changed keys", async () => {
    await auditCollectionSaved(TENANT, receipt({ amount: 1000 }), receipt({ amount: 1500 }));

    const input = mockAudit.recordModernAuditEvent.mock.calls[0][0];
    expect(input.actionType).toBe("UPDATE");
    expect(input.oldState).toMatchObject({ amount: 1000 });
    expect(input.newState).toMatchObject({ amount: 1500, changedFields: ["amount"] });
  });

  it("skips the audit row when a save changes nothing", async () => {
    await auditCollectionSaved(TENANT, receipt(), receipt());

    expect(mockAudit.recordModernAuditEvent).not.toHaveBeenCalled();
  });

  it("records a DELETE with the reason and emits a soft-delete outbox event", async () => {
    await auditCollectionsDeleted(
      TENANT,
      [receipt({ deletedAt: "2026-07-01T00:00:00.000Z", deletedBy: "usr-accountant" })],
      { deletedBy: "usr-accountant", reason: "Entered twice" },
    );

    const input = mockAudit.recordModernAuditEvent.mock.calls[0][0];
    expect(input.actionType).toBe("DELETE");
    expect(input.oldState).toMatchObject({ id: "oc-1" });
    expect(input.newState).toMatchObject({ deletionReason: "Entered twice" });

    const [events] = mockOutbox.emitOutboxEvents.mock.calls[0];
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("entity.soft_deleted");
    expect(events[0].payload).toMatchObject({
      entityType: "obligation_collections",
      entityId: "oc-1",
      tenantId: TENANT,
      deletionReason: "Entered twice",
      snapshot: { receipt_no: "REC-1", amount: 1500 },
    });
  });

  it("records a RESTORE and emits a restored outbox event", async () => {
    await auditCollectionsRestored(
      TENANT,
      [{ collection: receipt(), archivedAt: "2026-07-01T00:00:00.000Z" }],
      "usr-accountant",
    );

    const input = mockAudit.recordModernAuditEvent.mock.calls[0][0];
    expect(input.actionType).toBe("RESTORE");
    expect(input.newState).toMatchObject({ deletedAt: null, restoredBy: "usr-accountant" });

    const [events] = mockOutbox.emitOutboxEvents.mock.calls[0];
    expect(events[0].type).toBe("entity.restored");
    expect(events[0].payload).toMatchObject({ restoredBy: "usr-accountant" });
  });

  it("records the created and removed ids for a catalogue replace", async () => {
    await auditCatalogueReplaced(TENANT, "wakala_types", ["w-1", "w-2"], ["w-1", "w-3"]);

    const input = mockAudit.recordModernAuditEvent.mock.calls[0][0];
    expect(input).toMatchObject({ tableName: "wakala_types", actionType: "UPDATE" });
    expect(input.newState).toMatchObject({
      operation: "catalogue_replaced",
      createdIds: ["w-3"],
      removedIds: ["w-2"],
    });
  });

  it("never invents an actor when the request has none", async () => {
    mockActor.getRequestUserId.mockReturnValue(null);
    await auditCollectionSaved(TENANT, null, receipt());

    expect(mockAudit.recordModernAuditEvent.mock.calls[0][0].realUserId).toBeNull();
  });
});
