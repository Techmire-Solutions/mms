import { describe, expect, it } from "vitest";
import {
  findFiscalYearForDate,
  isFiscalYearClosed,
  isJournalEntryBalanced,
  isJournalLineSingleSided,
  isJournalSourceType,
  moneyAmountSchema,
  moneyToCents,
  resolveFiscalYearRef,
  signedMoneyAmountSchema,
} from "./accountingLedgerInvariants.js";

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
