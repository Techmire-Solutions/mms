import { describe, expect, it } from "vitest";
import {
  OBLIGATION_DESIGNATED_FOR,
  OBLIGATION_DISTRIBUTION_TYPES,
  OBLIGATION_PAYMENT_MODES,
  obligationDesignatedForSchema,
  obligationDistributionTypeSchema,
  obligationPaymentModeSchema,
} from "../obligations/obligationsEnums.js";
import {
  obligationCollectionInsertSchema,
  obligationCollectionRecordSchema,
  obligationCollectionUpdateSchema,
  obligationDistributionInsertSchema,
  obligationTypeInsertSchema,
} from "../obligations/obligationsModuleManifest.js";

/**
 * The module's closed vocabularies used to exist twice — as zod literals in the schemas and as
 * hand-written tuples in the frontend data shim — with nothing tying them (audit S2). These tests
 * pin the tuples to the schemas; `obligationsPersistenceDb` pins them to the database checks.
 */

describe("obligation enum tuples", () => {
  it.each([
    ["payment mode", obligationPaymentModeSchema, OBLIGATION_PAYMENT_MODES],
    ["distribution type", obligationDistributionTypeSchema, OBLIGATION_DISTRIBUTION_TYPES],
    ["designated for", obligationDesignatedForSchema, OBLIGATION_DESIGNATED_FOR],
  ] as const)("%s schema options equal its tuple", (_label, schema, tuple) => {
    expect(schema.options).toEqual([...tuple]);
  });

  it("rejects a value outside every tuple", () => {
    expect(obligationPaymentModeSchema.safeParse("Cheque").success).toBe(false);
    expect(obligationDistributionTypeSchema.safeParse("Expense").success).toBe(false);
    expect(obligationDesignatedForSchema.safeParse("Unknown").success).toBe(false);
  });

  it("keeps the DTOs on the canonical schemas", () => {
    // A row built from the tuple's first member validates; a foreign value does not — proving the
    // manifest derives from the enum module rather than carrying its own copy.
    expect(
      obligationTypeInsertSchema.safeParse({
        name: "Khums",
        designated_for: OBLIGATION_DESIGNATED_FOR[0],
      }).success,
    ).toBe(true);
    expect(
      obligationDistributionInsertSchema.safeParse({
        name: "Madrassah",
        wakala_type_id: "w-1",
        percentage: 50,
        type: OBLIGATION_DISTRIBUTION_TYPES[1],
      }).success,
    ).toBe(true);
  });
});

describe("obligation receipt date fields", () => {
  const receipt = {
    id: "oc-1",
    receipt_no: "REC-1",
    received_date: "2026-10-24",
    sender_id: "c-1",
    amount: 50000,
    currency_id: "PKR",
    payment_mode: "Cash" as const,
    obligation_type_id: "ot-1",
    mujtahid_representative_id: "rep-1",
    received_by: "u-1",
  };

  it("accepts a calendar date on the record and insert schemas", () => {
    expect(obligationCollectionRecordSchema.safeParse(receipt).success).toBe(true);
    const { id: _id, ...insert } = receipt;
    expect(obligationCollectionInsertSchema.safeParse(insert).success).toBe(true);
  });

  it.each(["24/10/2026", "2026-02-30", "2026-10-24T00:00:00Z", "", "  ", "not-a-date"])(
    "rejects %s before it reaches the database",
    (received_date) => {
      const { id: _id, ...insert } = { ...receipt, received_date };
      expect(obligationCollectionInsertSchema.safeParse(insert).success).toBe(false);
      expect(
        obligationCollectionRecordSchema.safeParse({ ...receipt, received_date }).success,
      ).toBe(false);
    },
  );

  it("keeps the OCC token optional on the update schema (documented last-write-wins path)", () => {
    const update = obligationCollectionUpdateSchema.safeParse({ amount: 10 });
    expect(update.success).toBe(true);
    expect(obligationCollectionUpdateSchema.safeParse({ amount: 10, version: 0 }).success).toBe(
      false,
    );
  });
});
