import { describe, expect, it } from "vitest";
import {
  PRIOR_UNCLOSED_RESULTS_CODE,
  buildMemberTrialBalance,
  consolidateTrialBalances,
  translateTrialBalance,
  type MemberTrialBalanceRow,
} from "./consolidationTranslation.js";

const rates = { closing: "280", average: "278", defaultHistorical: "270" };

const subsidiary: MemberTrialBalanceRow[] = [
  { code: "1000", name: "Cash", type: "Asset", balance: 110 },
  { code: "2500", name: "Due to parent", type: "Liability", balance: -10 },
  { code: "3000", name: "Share capital", type: "Equity", balance: -60 },
  { code: "3100", name: "Retained earnings", type: "Equity", balance: -20 },
  { code: "4000", name: "Fee income", type: "Revenue", balance: -50 },
  { code: "5000", name: "Salaries", type: "Expense", balance: 30 },
];

const parent: MemberTrialBalanceRow[] = [
  { code: "1000", name: "Cash", type: "Asset", balance: 50000 },
  { code: "1500", name: "Due from subsidiary", type: "Asset", balance: 2800 },
  { code: "3000", name: "Share capital", type: "Equity", balance: -52800 },
];

describe("translateTrialBalance", () => {
  it("given a USD subsidiary, should translate B/S at closing, P&L at average, equity at historical and plug CTA", () => {
    // Arrange / Act
    const translated = translateTrialBalance("sub", subsidiary, rates, "USD", "PKR");

    // Assert
    expect(translated.rows.map((row) => [row.code, row.rate, row.balance])).toEqual([
      ["1000", "280", 30800],
      ["2500", "280", -2800],
      ["3000", "270", -16200],
      ["3100", "270", -5400],
      ["4000", "278", -13900],
      ["5000", "278", 8340],
    ]);
    // Net assets 28,000 at closing vs 27,160 at historical/average → 840 translation gain in OCI.
    expect(translated.cta).toBe(840);
  });

  it("given an equity account with its own historical rate, should use it", () => {
    // Arrange / Act
    const translated = translateTrialBalance(
      "sub",
      subsidiary,
      { ...rates, historicalByCode: { "3000": "250" } },
      "USD",
      "PKR",
    );

    // Assert
    expect(translated.rows.find((row) => row.code === "3000")?.balance).toBe(-15000);
  });

  it("given a member already in the presentation currency, should translate 1:1 with no CTA", () => {
    // Arrange / Act
    const translated = translateTrialBalance("parent", parent, rates, "PKR", "PKR");

    // Assert
    expect(translated.rows.map((row) => row.balance)).toEqual([50000, 2800, -52800]);
    expect(translated.cta).toBe(0);
  });
});

describe("consolidateTrialBalances", () => {
  it("given an 80% subsidiary, should eliminate intercompany balances, keep CTA in OCI and balance", () => {
    // Arrange
    const members = [
      {
        translated: translateTrialBalance("parent", parent, rates, "PKR", "PKR"),
        ownershipPercent: 100,
      },
      {
        translated: translateTrialBalance("sub", subsidiary, rates, "USD", "PKR"),
        ownershipPercent: 80,
      },
    ];

    // Act
    const consolidated = consolidateTrialBalances(members, ["1500", "2500"], "PKR");

    // Assert
    expect(consolidated.rows.find((row) => row.code === "1000")?.balance).toBe(80800);
    expect(consolidated.rows.find((row) => row.code === "1500")).toMatchObject({
      combined: 2800,
      balance: 0,
    });
    expect(consolidated.rows.find((row) => row.code === "2500")).toMatchObject({
      combined: -2800,
      balance: 0,
    });
    expect(consolidated.cta).toBe(840);
    expect(consolidated.nonControllingInterest).toBe(5600);
    expect(consolidated.totals.debit).toBe(consolidated.totals.credit);
  });

  it("given intercompany balances translated at different rates, should move the residual into CTA", () => {
    // Arrange: the parent booked the receivable at 290, the subsidiary's payable translates at 280.
    const parentAt290 = parent.map((row) =>
      row.code === "1500"
        ? { ...row, balance: 2900 }
        : row.code === "3000"
          ? { ...row, balance: -52900 }
          : row,
    );
    const members = [
      {
        translated: translateTrialBalance("parent", parentAt290, rates, "PKR", "PKR"),
        ownershipPercent: 100,
      },
      {
        translated: translateTrialBalance("sub", subsidiary, rates, "USD", "PKR"),
        ownershipPercent: 100,
      },
    ];

    // Act
    const consolidated = consolidateTrialBalances(members, ["1500", "2500"], "PKR");

    // Assert: eliminating +2,900 and −2,800 leaves 100 that is FX, not a real balance.
    expect(consolidated.cta).toBe(840 - 100);
    expect(consolidated.totals.debit).toBe(consolidated.totals.credit);
  });
});

describe("buildMemberTrialBalance", () => {
  it("given unclosed prior-period results, should add one equity row so the member TB balances", () => {
    // Arrange: cash 150 against capital 100 means 50 of earlier profit was never closed.
    const balanceSheet = [
      { code: "1000", name: "Cash", type: "Asset", balance: 150 },
      { code: "3000", name: "Capital", type: "Equity", balance: -100 },
    ];
    const periodResults = [
      { code: "4000", name: "Income", type: "Revenue", balance: -30 },
      { code: "5000", name: "Expense", type: "Expense", balance: 10 },
    ];

    // Act
    const rows = buildMemberTrialBalance(balanceSheet, periodResults, "USD");

    // Assert
    expect(rows.at(-1)).toMatchObject({
      code: PRIOR_UNCLOSED_RESULTS_CODE,
      type: "Equity",
      balance: -30,
    });
    expect(rows.reduce((sum, row) => sum + row.balance, 0)).toBe(0);
  });
});
