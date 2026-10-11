import { describe, expect, it } from "vitest";
import {
  OBLIGATIONS_MODULE_MANIFEST,
  obligationCollectionRecordSchema,
  obligationCollectionInsertSchema,
  isObligationCollectionDeleted,
  filterActiveObligationCollections,
} from "../obligationsModuleManifest.js";

describe("obligationsModuleManifest and soft-delete invariants", () => {
  it("declares soft delete in module manifest", () => {
    expect(OBLIGATIONS_MODULE_MANIFEST.softDelete).toBeDefined();
    expect(OBLIGATIONS_MODULE_MANIFEST.softDelete?.workExcludesDeleted).toBe(true);
    expect(OBLIGATIONS_MODULE_MANIFEST.softDelete?.retentionDays).toBeNull();
  });

  it("declares granular permissions aligned with RBAC registry", () => {
    expect(OBLIGATIONS_MODULE_MANIFEST.permissions.read).toBe("obligations.read");
    expect(OBLIGATIONS_MODULE_MANIFEST.permissions.write).toBe("obligations.write");
    expect(OBLIGATIONS_MODULE_MANIFEST.permissions.delete).toBe("obligations.delete");
    expect(OBLIGATIONS_MODULE_MANIFEST.permissions.export).toBe("obligations.read");
    expect(OBLIGATIONS_MODULE_MANIFEST.permissions.reports).toBe("obligations.read");
  });

  it("obligationCollectionRecordSchema validates soft-delete metadata", () => {
    const parsed = obligationCollectionRecordSchema.safeParse({
      id: "oc-1",
      receipt_no: "REC-001",
      received_date: "2026-03-01",
      sender_id: "s-1",
      reference_id: null,
      amount: 500,
      currency_id: "USD",
      payment_mode: "Cash",
      obligation_type_id: "ot-1",
      mujtahid_representative_id: "rep-1",
      received_by: "Staff",
      deletedAt: "2026-03-10T12:00:00.000Z",
      deletedBy: "u-admin",
      deletionReason: "Incorrect entry",
    });
    expect(parsed.success).toBe(true);
  });

  it("obligationCollectionInsertSchema rejects soft-delete fields", () => {
    const validBase = {
      receipt_no: "REC-002",
      received_date: "2026-03-01",
      sender_id: "s-1",
      amount: 100,
      currency_id: "USD",
      payment_mode: "Cash" as const,
      obligation_type_id: "ot-1",
      mujtahid_representative_id: "rep-1",
      received_by: "Staff",
    };
    expect(obligationCollectionInsertSchema.safeParse(validBase).success).toBe(true);

    const withDeletedAt = obligationCollectionInsertSchema.safeParse({
      ...validBase,
      deletedAt: "2026-03-10T12:00:00.000Z",
    });
    expect(withDeletedAt.success).toBe(false);

    const withDeletedBy = obligationCollectionInsertSchema.safeParse({
      ...validBase,
      deletedBy: "u-admin",
    });
    expect(withDeletedBy.success).toBe(false);

    const withDeletionReason = obligationCollectionInsertSchema.safeParse({
      ...validBase,
      deletionReason: "Test reason",
    });
    expect(withDeletionReason.success).toBe(false);
  });

  it("isObligationCollectionDeleted and filterActiveObligationCollections identify active vs deleted records", () => {
    expect(isObligationCollectionDeleted({ deletedAt: "2026-03-10T12:00:00.000Z" })).toBe(true);
    expect(isObligationCollectionDeleted({ deletedAt: null })).toBe(false);
    expect(isObligationCollectionDeleted({})).toBe(false);

    const items = [
      { id: "1", deletedAt: null },
      { id: "2", deletedAt: "2026-03-10T12:00:00.000Z" },
      { id: "3" },
    ];
    const active = filterActiveObligationCollections(items);
    expect(active.map((x) => x.id)).toEqual(["1", "3"]);
  });
});
