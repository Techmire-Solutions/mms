import { describe, expect, it } from "vitest";
import {
  hedgeRelationshipCreateSchema,
  type HedgeRelationshipCreate,
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
