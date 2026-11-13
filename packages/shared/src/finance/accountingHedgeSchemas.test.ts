import { describe, expect, it } from "vitest";
import {
  hedgeRelationshipCreateSchema,
  hedgeRelationshipRecordSchema,
  hedgeValuationRecordSchema,
  type HedgeRelationship,
  type HedgeRelationshipCreate,
  type HedgeValuationRecord,
  hedgeDiscontinuationRequestSchema,
} from "./accountingHedgeSchemas.js";

const designation: HedgeRelationshipCreate = {
  name: "January book import",
  hedgeType: "cash_flow",
  direction: "buy",
  currency: "USD",
  notional: "1000",
  contractRate: "283",
  designationRate: "285",
  designationDate: "2026-10-01",
  maturityDate: "2027-01-31",
  hedgedItem: "Forecast USD purchase of textbooks",
  riskManagementObjective: "Fix the PKR cost of the January import",
  instrumentAccountId: "deriv",
  reserveAccountId: "cfhr",
  pnlAccountId: "hpl",
};

const parse = (overrides: Partial<HedgeRelationshipCreate>) =>
  hedgeRelationshipCreateSchema.safeParse({ ...designation, ...overrides });

describe("hedge designation notional", () => {
  it("accepts a notional at the currency's own scale", () => {
    expect(parse({ notional: "1000.12" }).success).toBe(true);
  });

  it("accepts a whole amount for a zero-decimal currency", () => {
    expect(parse({ currency: "JPY", notional: "1000" }).success).toBe(true);
  });

  it("rejects a notional with more decimals than the currency allows", () => {
    // `numeric(19,4)` stores this, but no valuation could ever read it as money:
    // the hedge used to be accepted and then crash on its first valuation.
    const result = parse({ notional: "1000.1234" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "notional")).toBe(true);
    }
  });

  it("rejects a fractional notional in a zero-decimal currency", () => {
    expect(parse({ currency: "JPY", notional: "1000.5" }).success).toBe(false);
  });
});

describe("hedge discontinuation request", () => {
  it("accepts a date and a reason", () => {
    expect(
      hedgeDiscontinuationRequestSchema.safeParse({
        date: "2026-12-31",
        reason: "Forecast purchase cancelled",
      }).success,
    ).toBe(true);
  });

  it("rejects a missing reason or an unknown field", () => {
    expect(hedgeDiscontinuationRequestSchema.safeParse({ date: "2026-12-31" }).success).toBe(false);
    expect(
      hedgeDiscontinuationRequestSchema.safeParse({
        date: "2026-12-31",
        reason: "no longer qualifies",
        deleteHedge: true,
      }).success,
    ).toBe(false);
  });
});

describe("hedge record types are inferred from their schemas", () => {
  // The manual `HedgeRelationship`/`HedgeValuationRecord` interfaces used to mirror
  // these schemas by hand while `sendValidated` accepted an `unknown` payload, so a
  // drift between the two would only surface as a runtime 500. The types are now
  // `z.infer` outputs; this fixture pins the wire shape they must accept.
  const valuation: HedgeValuationRecord = {
    valuationDate: "2026-11-30",
    kind: "valuation",
    rate: "290",
    instrumentValue: "7000",
    hedgedChange: "6800",
    effective: "6800",
    ineffective: "200",
    entryId: "je-1",
    reversalEntryId: null,
  };

  const record: HedgeRelationship = {
    ...designation,
    id: "h-1",
    status: "active",
    settledReserve: "0",
    valuations: [valuation],
  };

  it("accepts a relationship shaped exactly like the use-case return value", () => {
    expect(hedgeRelationshipRecordSchema.safeParse(record).success).toBe(true);
    expect(hedgeValuationRecordSchema.safeParse(valuation).success).toBe(true);
  });

  it("rejects a non-canonical decimal the schema owns", () => {
    expect(
      hedgeValuationRecordSchema.safeParse({ ...valuation, instrumentValue: "7000.0000000000" })
        .success,
    ).toBe(false);
  });
});
