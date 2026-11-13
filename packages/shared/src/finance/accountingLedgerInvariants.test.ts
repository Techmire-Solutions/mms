import { describe, expect, it } from "vitest";
import {
  findFiscalYearForDate,
  isFiscalYearClosed,
  isJournalEntryBalanced,
  isJournalLineSingleSided,
  isJournalSourceType,
  moneyAmountSchema,
  moneyToCents,
  parseMoneyAmountNumber,
  roundMoneyAmount,
  resolveDefaultFiscalYear,
  resolveFiscalYearRef,
  signedMoneyAmountSchema,
  tryParseMoneyAmountNumber,
} from "./accountingLedgerInvariants.js";
import {
  formatJournalCurrencyImbalance,
  journalCurrencyImbalances,
} from "./accountingCurrencyBalance.js";

describe("accountingLedgerInvariants", () => {
  it("rounds money to cents without float drift", () => {
    expect(moneyToCents(10.1 + 10.2)).toBe(2030);
    expect(moneyToCents(0.1 + 0.2)).toBe(30);
  });

  it("requires a single-sided journal line", () => {
    expect(isJournalLineSingleSided({ debit: 10, credit: 0 })).toBe(true);
    expect(isJournalLineSingleSided({ debit: 0, credit: 10 })).toBe(true);
    expect(isJournalLineSingleSided({ debit: 0, credit: 0 })).toBe(true);
    expect(isJournalLineSingleSided({ debit: 5, credit: 5 })).toBe(false);
    expect(isJournalLineSingleSided({ debit: -1, credit: 0 })).toBe(false);
  });

  it("accepts a balanced two-line entry and rejects posted-style imbalance", () => {
    expect(
      isJournalEntryBalanced([
        { debit: 150.5, credit: 0 },
        { debit: 0, credit: 150.5 },
      ]),
    ).toBe(true);
    expect(
      isJournalEntryBalanced([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 99.99 },
      ]),
    ).toBe(false);
    expect(isJournalEntryBalanced([{ debit: 50, credit: 0 }])).toBe(false);
    expect(
      isJournalEntryBalanced([
        { debit: 0, credit: 0 },
        { debit: 0, credit: 0 },
      ]),
    ).toBe(false);
  });

  it("resolves fiscal years by id or label and detects closed status", () => {
    const years = [
      { id: "fy-1", label: "2026-2027", status: "active" },
      { id: "fy-0", label: "2025-2026", status: "closed" },
    ];
    expect(resolveFiscalYearRef(years, "fy-1")?.label).toBe("2026-2027");
    expect(resolveFiscalYearRef(years, "2025-2026")?.id).toBe("fy-0");
    expect(resolveFiscalYearRef(years, "  ")).toBeNull();
    expect(isFiscalYearClosed(resolveFiscalYearRef(years, "fy-0"))).toBe(true);
    expect(isFiscalYearClosed(resolveFiscalYearRef(years, "fy-1"))).toBe(false);
  });

  it("narrows journal source types", () => {
    expect(isJournalSourceType("payment")).toBe(true);
    expect(isJournalSourceType("wire")).toBe(false);
  });

  it("resolves a fiscal year by the date its range contains, inclusive of both ends", () => {
    const years = [
      {
        id: "fy-1",
        label: "2025-2026",
        status: "closed",
        startDate: "2025-07-01",
        endDate: "2026-06-30",
      },
      {
        id: "fy-2",
        label: "2026-2027",
        status: "active",
        startDate: "2026-07-01",
        endDate: "2027-06-30",
      },
    ];
    expect(findFiscalYearForDate(years, "2025-07-01")?.id).toBe("fy-1");
    expect(findFiscalYearForDate(years, "2026-06-30")?.id).toBe("fy-1");
    expect(findFiscalYearForDate(years, "2026-07-01")?.id).toBe("fy-2");
    expect(findFiscalYearForDate(years, "2027-06-30")?.id).toBe("fy-2");
    // Outside every configured year, or absent, stays unresolved so a workspace
    // with no fiscal years configured remains postable.
    expect(findFiscalYearForDate(years, "2020-01-01")).toBeNull();
    expect(findFiscalYearForDate(years, "2030-01-01")).toBeNull();
    expect(findFiscalYearForDate(years, "")).toBeNull();
    expect(findFiscalYearForDate(years, undefined)).toBeNull();
    expect(findFiscalYearForDate([], "2026-08-01")).toBeNull();
  });

  it("requires fiscal-year dates to use real ISO calendar dates", async () => {
    const { fiscalYearRecordSchema } = await import("./accountingModuleManifest.js");
    expect(
      fiscalYearRecordSchema.safeParse({
        id: "fy",
        label: "2026-2027",
        startDate: "2026-07-01",
        endDate: "2027-06-30",
        status: "active",
      }).success,
    ).toBe(true);
    expect(
      fiscalYearRecordSchema.safeParse({
        id: "fy",
        label: "bad",
        startDate: "01/07/2026",
        endDate: "2027-06-30",
        status: "active",
      }).success,
    ).toBe(false);
    expect(
      fiscalYearRecordSchema.safeParse({
        id: "fy",
        label: "bad",
        startDate: "2026-02-30",
        endDate: "2027-06-30",
        status: "active",
      }).success,
    ).toBe(false);
  });

  it("rejects money with more than two decimal places or negative values", () => {
    expect(moneyAmountSchema.safeParse(10.25).success).toBe(true);
    expect(moneyAmountSchema.safeParse(0).success).toBe(true);
    expect(moneyAmountSchema.safeParse(10.005).success).toBe(false);
    expect(moneyAmountSchema.safeParse(-1).success).toBe(false);
    expect(moneyAmountSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);

    expect(signedMoneyAmountSchema.safeParse(-10.5).success).toBe(true);
    expect(signedMoneyAmountSchema.safeParse(10.005).success).toBe(false);
  });
});

describe("resolveDefaultFiscalYear", () => {
  const fy2025 = {
    id: "a",
    label: "2025-26",
    status: "active",
    startDate: "2025-07-01",
    endDate: "2026-06-30",
  };
  const fy2026 = {
    id: "b",
    label: "2026-27",
    status: "upcoming",
    startDate: "2026-07-01",
    endDate: "2027-06-30",
  };
  const fy2024 = {
    id: "c",
    label: "2024-25",
    status: "closed",
    startDate: "2024-07-01",
    endDate: "2025-06-30",
  };

  it("prefers the open year containing today over the active flag", () => {
    expect(resolveDefaultFiscalYear([fy2025, fy2026], "2026-10-17")?.id).toBe("b");
  });

  it("never defaults to a closed year even when it contains today", () => {
    expect(resolveDefaultFiscalYear([fy2024, fy2025], "2025-01-15")?.id).toBe("a");
  });

  it("falls back to the active year, then null", () => {
    expect(resolveDefaultFiscalYear([fy2025, fy2026], "2030-01-01")?.id).toBe("a");
    expect(resolveDefaultFiscalYear([fy2026], "2030-01-01")).toBeNull();
    expect(resolveDefaultFiscalYear(undefined, "2026-10-17")).toBeNull();
  });
});

describe("exact money parsing", () => {
  it("parses validated 2-dp input without a float", () => {
    expect(parseMoneyAmountNumber("1250.75")).toBe(1250.75);
    expect(parseMoneyAmountNumber("0.10")).toBe(0.1);
    expect(parseMoneyAmountNumber(10.5)).toBe(10.5);
    expect(() => parseMoneyAmountNumber("1.234")).toThrow(/two decimal/);
    expect(() => parseMoneyAmountNumber("-1")).toThrow(/negative/);
    expect(() => parseMoneyAmountNumber("abc")).toThrow(/Invalid decimal/);
  });

  it("returns null for invalid UI input instead of NaN", () => {
    expect(tryParseMoneyAmountNumber("")).toBeNull();
    expect(tryParseMoneyAmountNumber("abc")).toBeNull();
    expect(tryParseMoneyAmountNumber("10.25")).toBe(10.25);
  });

  it("rounds arbitrary decimals half-up to the ledger's cents", () => {
    expect(roundMoneyAmount("1.005")).toBe(1.01);
    expect(roundMoneyAmount("1.0049")).toBe(1);
    expect(roundMoneyAmount("0.0049")).toBe(0);
    expect(roundMoneyAmount("1234.5678912345")).toBe(1234.57);
    // Half-up on the magnitude: -1.005 rounds away from zero to -1.01.
    expect(roundMoneyAmount(-1.005)).toBe(-1.01);
  });

  it("rejects a value beyond exact integer cents", () => {
    expect(() => parseMoneyAmountNumber("999999999999999.99")).toThrow(/exact integer cents/);
  });
});

describe("single-currency voucher balance (IAS 21 transaction amounts)", () => {
  const line = (txn_currency: string, txn_debit: string | null, txn_credit: string | null) => ({
    txn_currency,
    txn_debit,
    txn_credit,
  });

  it("accepts a foreign voucher whose document legs balance", () => {
    const lines = [line("USD", "100.00", "0.00"), line("USD", "0.00", "100.00")];
    expect(journalCurrencyImbalances(lines)).toEqual([]);
  });

  it("reports a foreign voucher whose document legs do not balance", () => {
    // Rates differ per line, so the functional totals can net out while the document
    // itself is short by 80 USD — the shape that used to pass silently.
    const lines = [
      line("USD", "100.00", "0.00"),
      line("USD", "0.00", "100.00"),
      line("USD", "0.00", "80.00"),
    ];
    const imbalances = journalCurrencyImbalances(lines);
    expect(imbalances).toHaveLength(1);
    expect(imbalances[0]).toMatchObject({
      currency: "USD",
      debit: "100.00",
      credit: "180.00",
      difference: "-80.00",
    });
    expect(formatJournalCurrencyImbalance(imbalances[0]!)).toContain("USD");
  });

  it("skips a mixed-currency settlement entry (legs differ by design)", () => {
    // A USD receivable retired against PKR cash: a per-currency balance does not apply.
    const lines = [
      line("USD", "0.00", "1000.00"),
      line("PKR", "285000.00", "0.00"),
      line("PKR", "0.00", "500.00"),
    ];
    expect(journalCurrencyImbalances(lines)).toEqual([]);
  });

  it("skips a currency with a missing leg instead of reporting a false imbalance", () => {
    expect(
      journalCurrencyImbalances([line("USD", "100.00", null), line("USD", "0.00", null)]),
    ).toEqual([]);
  });

  it("also applies to a functional-currency-only voucher", () => {
    expect(
      journalCurrencyImbalances([line("PKR", "10.00", "0.00"), line("PKR", "0.00", "9.00")]),
    ).toHaveLength(1);
  });

  it("keeps a four-decimal currency exact", () => {
    // CLF carries four minor units, so the difference survives at that scale.
    const lines = [line("CLF", "1.0001", "0.0000"), line("CLF", "0.0000", "1.0000")];
    expect(journalCurrencyImbalances(lines)[0]?.difference).toBe("0.0001");
  });
});
