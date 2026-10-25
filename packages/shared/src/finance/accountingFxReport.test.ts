import { describe, expect, it } from "vitest";
import { fxReportQuerySchema, sumStoredAmounts, summarizeFxExposure } from "./accountingFxReport.js";
import type { ForeignMonetaryBalance } from "./accountingFxRevaluation.js";

const balance = (overrides: Partial<ForeignMonetaryBalance>): ForeignMonetaryBalance => ({
  accountId: "ar",
  accountCode: "1100",
  accountName: "Fee Receivable",
  currency: "USD",
  openTxn: "0",
  carryingFunc: "0",
  ...overrides,
});

describe("summarizeFxExposure", () => {
  it("given USD receivable and payable balances, should net them per currency at the closing rate", () => {
    // Arrange
    const balances = [
      balance({ openTxn: "1000.0000", carryingFunc: "280000.0000" }),
      balance({ accountId: "ap", accountCode: "2100", openTxn: "-400", carryingFunc: "-113200" }),
    ];

    // Act
    const [usd] = summarizeFxExposure(balances, new Map([["USD", "283"]]), "PKR");

    // Assert
    expect(usd).toEqual({
      currency: "USD",
      openTxn: "600.00",
      carryingFunc: "166800.00",
      closingRate: "283",
      revaluedFunc: "169800.00",
      unrealized: "3000.00",
    });
  });

  it("given a currency without a closing rate, should report the balance but not value it", () => {
    // Arrange / Act
    const [eur] = summarizeFxExposure([balance({ currency: "EUR", openTxn: "50", carryingFunc: "15000" })], new Map(), "PKR");

    // Assert
    expect(eur).toMatchObject({ currency: "EUR", openTxn: "50.00", closingRate: null, revaluedFunc: null, unrealized: null });
  });

  it("given several currencies, should order them by code", () => {
    // Arrange / Act
    const rows = summarizeFxExposure(
      [balance({ currency: "USD", openTxn: "1" }), balance({ currency: "EUR", openTxn: "1" })],
      new Map(),
      "PKR",
    );

    // Assert
    expect(rows.map((row) => row.currency)).toEqual(["EUR", "USD"]);
  });
});

describe("fx report helpers", () => {
  it("given stored numeric strings, should sum them exactly in minor units", () => {
    // Arrange / Act / Assert
    expect(sumStoredAmounts(["0.1000", "0.2000", "-1500"], "PKR")).toBe("-1499.70");
  });

  it("given a start after the as-of date, should reject the query", () => {
    // Arrange / Act / Assert
    expect(fxReportQuerySchema.safeParse({ from: "2026-12-01", asOf: "2026-11-30" }).success).toBe(false);
    expect(fxReportQuerySchema.safeParse({ from: "2026-01-01", asOf: "2026-11-30" }).success).toBe(true);
  });
});
