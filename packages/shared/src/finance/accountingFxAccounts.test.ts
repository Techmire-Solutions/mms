import { describe, expect, it } from "vitest";
import { inferIsMonetaryAccount } from "./accountingFxAccounts.js";

describe("inferIsMonetaryAccount", () => {
  it("treats cash, bank and receivables as monetary assets", () => {
    expect(
      inferIsMonetaryAccount({ type: "Asset", subtype: "Current Asset", name: "Cash in Hand" }),
    ).toBe(true);
    expect(
      inferIsMonetaryAccount({ type: "Asset", subtype: "Current Asset", name: "Meezan Bank" }),
    ).toBe(true);
    expect(
      inferIsMonetaryAccount({ type: "Asset", subtype: "Current Asset", name: "Fee Receivable" }),
    ).toBe(true);
  });

  it("keeps inventory, prepaid and fixed assets at historical rates", () => {
    expect(
      inferIsMonetaryAccount({ type: "Asset", subtype: "Current Asset", name: "Inventory" }),
    ).toBe(false);
    expect(
      inferIsMonetaryAccount({ type: "Asset", subtype: "Current Asset", name: "Prepaid Rent" }),
    ).toBe(false);
    expect(
      inferIsMonetaryAccount({ type: "Asset", subtype: "Fixed Asset", name: "Bank Building" }),
    ).toBe(false);
  });

  it("treats liabilities as monetary except unearned revenue and advances received", () => {
    expect(
      inferIsMonetaryAccount({
        type: "Liability",
        subtype: "Current Liability",
        name: "Accounts Payable",
      }),
    ).toBe(true);
    expect(
      inferIsMonetaryAccount({
        type: "Liability",
        subtype: "Current Liability",
        name: "Unearned Fees",
      }),
    ).toBe(false);
    expect(
      inferIsMonetaryAccount({
        type: "Liability",
        subtype: "Current Liability",
        name: "Advances Received",
      }),
    ).toBe(false);
  });

  it("never classifies equity, revenue or expense as monetary", () => {
    expect(
      inferIsMonetaryAccount({
        type: "Equity",
        subtype: "Retained Earnings",
        name: "Cash Reserve",
      }),
    ).toBe(false);
    expect(
      inferIsMonetaryAccount({
        type: "Revenue",
        subtype: "Operating Revenue",
        name: "Bank Profit",
      }),
    ).toBe(false);
  });
});
