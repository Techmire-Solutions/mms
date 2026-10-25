import { describe, expect, it } from "vitest";
import { isJournalEntryBalanced } from "./accountingLedgerInvariants.js";
import {
  MissingPriceIndexError,
  buildIas29JournalLines,
  computeIas29Restatement,
  indexOnOrBefore,
  isRestatedByIas29,
  priceIndexPointSchema,
  type MonthlyMovement,
  type PriceIndexPoint,
} from "./accountingHyperinflation.js";

const movement = (overrides: Partial<MonthlyMovement>): MonthlyMovement => ({
  accountId: "land",
  accountCode: "1500",
  accountName: "Land",
  type: "Asset",
  isMonetary: false,
  month: "2026-01",
  netFunc: "0",
  ...overrides,
});

const index = (indexDate: string, value: string): PriceIndexPoint => ({
  indexDate,
  value,
  source: "",
});

const points = [index("2026-01-31", "100"), index("2026-06-30", "120"), index("2026-12-31", "150")];

const opening = [
  movement({ netFunc: "600.0000" }),
  movement({
    accountId: "cash",
    accountCode: "1000",
    accountName: "Cash",
    isMonetary: true,
    netFunc: "400.0000",
  }),
  movement({
    accountId: "equity",
    accountCode: "3000",
    accountName: "Capital",
    type: "Equity",
    netFunc: "-1000.0000",
  }),
];

describe("computeIas29Restatement", () => {
  it("given 400 of net monetary assets and 50% inflation, should report a 200 monetary loss", () => {
    // Arrange / Act
    const result = computeIas29Restatement(opening, points, "2026-12-31", "PKR");

    // Assert
    expect(result.closingIndex).toBe("150");
    expect(result.netMonetaryResult).toBe("-200.00");
    expect(result.lines).toEqual([
      {
        accountId: "land",
        accountCode: "1500",
        accountName: "Land",
        carrying: "600.00",
        restated: "900.00",
        adjustment: "300.00",
      },
      {
        accountId: "equity",
        accountCode: "3000",
        accountName: "Capital",
        carrying: "-1000.00",
        restated: "-1500.00",
        adjustment: "-500.00",
      },
    ]);
  });

  it("given movements in different months, should restate each from its own month's index", () => {
    // Arrange
    const movements = [
      movement({ netFunc: "100" }),
      movement({ month: "2026-07", netFunc: "120" }),
    ];

    // Act
    const [line] = computeIas29Restatement(movements, points, "2026-12-31", "PKR").lines;

    // Assert
    expect(line).toMatchObject({ carrying: "220.00", restated: "300.00", adjustment: "80.00" });
  });

  it("given only monetary items, should post nothing", () => {
    // Arrange
    const cash = [movement({ isMonetary: true, netFunc: "500" })];

    // Act
    const result = computeIas29Restatement(cash, points, "2026-12-31", "PKR");

    // Assert
    expect(result).toMatchObject({ lines: [], netMonetaryResult: "0.00" });
  });

  it("given a month with activity but no index on or before it, should name the month", () => {
    // Arrange
    const early = [movement({ month: "2025-11", netFunc: "100" })];

    // Act
    const run = () => computeIas29Restatement(early, points, "2026-12-31", "PKR");

    // Assert
    expect(run).toThrow(MissingPriceIndexError);
    expect(run).toThrow(/2025-11/);
  });

  it("given no closing index, should refuse rather than restate at 1", () => {
    // Arrange / Act
    const run = () => computeIas29Restatement(opening, [], "2026-12-31", "PKR");

    // Assert
    expect(run).toThrow(MissingPriceIndexError);
  });
});

describe("buildIas29JournalLines", () => {
  it("given a restatement, should balance with the loss debited to the monetary account", () => {
    // Arrange
    const result = computeIas29Restatement(opening, points, "2026-12-31", "PKR");

    // Act
    const lines = buildIas29JournalLines(result, "nmp", "PKR");

    // Assert
    expect(isJournalEntryBalanced(lines)).toBe(true);
    expect(lines.at(-1)).toMatchObject({ account_id: "nmp", debit: 200, credit: 0 });
  });

  it("given net monetary liabilities, should credit a gain", () => {
    // Arrange
    const borrowed = [
      movement({ netFunc: "1000" }),
      movement({
        accountId: "loan",
        accountCode: "2100",
        type: "Liability",
        isMonetary: true,
        netFunc: "-400",
      }),
      movement({ accountId: "equity", accountCode: "3000", type: "Equity", netFunc: "-600" }),
    ];
    const result = computeIas29Restatement(borrowed, points, "2026-12-31", "PKR");

    // Act
    const lines = buildIas29JournalLines(result, "nmp", "PKR");

    // Assert
    expect(result.netMonetaryResult).toBe("200.00");
    expect(lines.at(-1)).toMatchObject({ account_id: "nmp", debit: 0, credit: 200 });
  });
});

describe("price index helpers", () => {
  it("given unsorted points, should pick the latest on or before the date", () => {
    // Arrange / Act / Assert
    expect(indexOnOrBefore([points[2], points[0], points[1]], "2026-07-15")).toBe("120");
    expect(indexOnOrBefore(points, "2025-12-31")).toBeNull();
  });

  it("given account kinds, should restate non-monetary, equity and P&L only", () => {
    // Arrange / Act / Assert
    expect(isRestatedByIas29({ type: "Asset", isMonetary: true })).toBe(false);
    expect(isRestatedByIas29({ type: "Liability", isMonetary: false })).toBe(true);
    expect(isRestatedByIas29({ type: "Revenue", isMonetary: false })).toBe(true);
  });

  it("given a zero or malformed index, should reject it", () => {
    // Arrange / Act / Assert
    expect(priceIndexPointSchema.safeParse({ indexDate: "2026-01-31", value: "0" }).success).toBe(
      false,
    );
    expect(
      priceIndexPointSchema.safeParse({ indexDate: "2026-01-31", value: "1.2345678" }).success,
    ).toBe(false);
    expect(
      priceIndexPointSchema.safeParse({ indexDate: "2026-01-31", value: "104.25" }).success,
    ).toBe(true);
  });
});
