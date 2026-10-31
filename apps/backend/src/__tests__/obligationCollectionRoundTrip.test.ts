import { describe, expect, it } from "vitest";
import { obligationCollectionListSchema } from "@mms/shared";
import { obligationCollectionRowToRecord } from "../db/repositories/obligationCollectionsRepository.js";

/**
 * The bulk save endpoint echoes the rows the list endpoint returned, so a key
 * the read path emits but the strict write schema rejects breaks every save
 * once the workspace holds a single collection.
 */
describe("obligation collection read/write round trip", () => {
  it("given a stored row, should accept the read-path record when bulk saving", () => {
    // Arrange
    const row = {
      id: "oc-1",
      receiptNo: "OBL-00001",
      receivedDate: "2026-09-12",
      senderId: "cnt-1",
      referenceId: null,
      amount: "10000.00",
      currencyId: "cur1",
      paymentMode: "Cash",
      obligationTypeId: "ot-1",
      mujtahidRepresentativeId: "rep-1",
      receivedBy: "usr-1",
      createdAt: new Date("2026-09-12T00:00:00.000Z"),
      updatedAt: new Date("2026-09-12T00:00:00.000Z"),
      createdBy: "usr-1",
      updatedBy: "usr-1",
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
      restoredAt: null,
      restoredBy: null,
      deletedWithCascade: null,
    };

    // Act
    const record = obligationCollectionRowToRecord(
      row as unknown as Parameters<typeof obligationCollectionRowToRecord>[0],
    );
    const parsed = obligationCollectionListSchema.safeParse([record]);

    // Assert
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });
});
