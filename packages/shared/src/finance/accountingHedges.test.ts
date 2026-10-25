import { describe, expect, it } from "vitest";
import { isJournalEntryBalanced } from "./accountingLedgerInvariants.js";
import {
  buildHedgeValuationLines,
  buildReserveReclassificationLines,
  computeHedgeValuation,
} from "./accountingHedges.js";
import { hedgeRelationshipCreateSchema } from "./accountingHedgeSchemas.js";

const terms = (overrides: Partial<Parameters<typeof computeHedgeValuation>[0]> = {}) => ({
  hedgeType: "cash_flow" as const,
  direction: "buy" as const,
  currency: "USD",
  notional: "1000",
  contractRate: "285",
  designationRate: "283",
  ...overrides,
});

const accounts = { instrumentAccountId: "deriv", reserveAccountId: "cfhr", pnlAccountId: "hpl" };

describe("computeHedgeValuation", () => {
  it("given an under-hedge, should put the whole instrument gain in OCI", () => {
    // Arrange / Act
    const valuation = computeHedgeValuation(terms(), "290", "PKR");

    // Assert
    expect(valuation).toEqual({
      rate: "290",
      instrumentValue: "5000.00",
      hedgedChange: "-7000.00",
      effective: "5000.00",
      ineffective: "0.00",
    });
  });

  it("given an over-hedge, should cap OCI at the hedged change and send the excess to P&L", () => {
    // Arrange / Act
    const valuation = computeHedgeValuation(
      terms({ contractRate: "283", designationRate: "285" }),
      "290",
      "PKR",
    );

    // Assert
    expect(valuation).toMatchObject({
      instrumentValue: "7000.00",
      effective: "5000.00",
      ineffective: "2000.00",
    });
  });

  it("given movements that do not offset, should recognise nothing in OCI", () => {
    // Arrange / Act
    const valuation = computeHedgeValuation(
      terms({ contractRate: "283", designationRate: "285" }),
      "284",
      "PKR",
    );

    // Assert
    expect(valuation).toMatchObject({
      instrumentValue: "1000.00",
      effective: "0.00",
      ineffective: "1000.00",
    });
  });

  it("given a sold forward and a stronger foreign currency, should report a loss", () => {
    // Arrange / Act
    const valuation = computeHedgeValuation(
      terms({ direction: "sell", designationRate: "285" }),
      "290",
      "PKR",
    );

    // Assert
    expect(valuation).toMatchObject({
      instrumentValue: "-5000.00",
      effective: "-5000.00",
      ineffective: "0.00",
    });
  });

  it("given a fair value hedge, should take the whole change to P&L", () => {
    // Arrange / Act
    const valuation = computeHedgeValuation(terms({ hedgeType: "fair_value" }), "290", "PKR");

    // Assert
    expect(valuation).toMatchObject({
      effective: "0.00",
      ineffective: "5000.00",
      hedgedChange: "0.00",
    });
  });
});

describe("hedge journal lines", () => {
  it("given a gain split between OCI and P&L, should balance with the derivative debited", () => {
    // Arrange
    const valuation = computeHedgeValuation(
      terms({ contractRate: "283", designationRate: "285" }),
      "290",
      "PKR",
    );

    // Act
    const lines = buildHedgeValuationLines(valuation, accounts, "Hedge valuation");

    // Assert
    expect(isJournalEntryBalanced(lines)).toBe(true);
    expect(lines.map((line) => [line.account_id, line.debit, line.credit])).toEqual([
      ["deriv", 7000, 0],
      ["cfhr", 0, 5000],
      ["hpl", 0, 2000],
    ]);
  });

  it("given a loss, should credit the derivative liability", () => {
    // Arrange
    const valuation = computeHedgeValuation(
      terms({ direction: "sell", designationRate: "285" }),
      "290",
      "PKR",
    );

    // Act
    const lines = buildHedgeValuationLines(valuation, accounts, "Hedge valuation");

    // Assert
    expect(lines.map((line) => [line.account_id, line.debit, line.credit])).toEqual([
      ["deriv", 0, 5000],
      ["cfhr", 5000, 0],
    ]);
  });

  it("given a reserve gain, should reclassify it from OCI into profit or loss", () => {
    // Arrange / Act
    const lines = buildReserveReclassificationLines("5000.00", "cfhr", "cost", "Reclassify");

    // Assert
    expect(isJournalEntryBalanced(lines)).toBe(true);
    expect(lines.map((line) => [line.account_id, line.debit, line.credit])).toEqual([
      ["cfhr", 5000, 0],
      ["cost", 0, 5000],
    ]);
  });
});

describe("hedgeRelationshipCreateSchema", () => {
  const base = {
    name: "USD purchase hedge",
    hedgeType: "cash_flow",
    direction: "buy",
    currency: "USD",
    notional: "1000",
    contractRate: "285",
    designationRate: "283",
    designationDate: "2026-10-01",
    maturityDate: "2027-01-31",
    hedgedItem: "Forecast book import",
    riskManagementObjective: "Fix the PKR cost of the January import",
    instrumentAccountId: "deriv",
    reserveAccountId: "cfhr",
    pnlAccountId: "hpl",
  };

  it("given a cash flow hedge without a reserve account or a maturity after designation, should reject it", () => {
    // Arrange / Act / Assert
    expect(hedgeRelationshipCreateSchema.safeParse(base).success).toBe(true);
    expect(
      hedgeRelationshipCreateSchema.safeParse({ ...base, reserveAccountId: null }).success,
    ).toBe(false);
    expect(
      hedgeRelationshipCreateSchema.safeParse({ ...base, maturityDate: "2026-09-30" }).success,
    ).toBe(false);
    expect(hedgeRelationshipCreateSchema.safeParse({ ...base, notional: "0" }).success).toBe(false);
  });
});
