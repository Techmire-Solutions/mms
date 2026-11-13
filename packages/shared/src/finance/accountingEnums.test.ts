import { describe, expect, it } from "vitest";
import {
  ACCOUNT_TYPE_NORMAL_BALANCE,
  ACCOUNTING_ACCOUNT_TYPES,
  EXCHANGE_RATE_SOURCES,
  FINANCE_PAYMENT_METHODS,
  JOURNAL_ENTRY_STATUSES,
  JOURNAL_TAGS,
  accountTypeFromDb,
  coerceExchangeRateSource,
  coerceFinancePaymentMethod,
  isDebitNormalAccountType,
  isExchangeRateSource,
  isJournalEntryReversed,
  normalBalanceForAccountType,
  normalizePaymentMethod,
} from "./accountingEnums.js";

describe("account type policy", () => {
  it("declares a normal balance for every account type", () => {
    expect(Object.keys(ACCOUNT_TYPE_NORMAL_BALANCE).sort()).toEqual(
      [...ACCOUNTING_ACCOUNT_TYPES].sort(),
    );
    expect(normalBalanceForAccountType("Asset")).toBe("debit");
    expect(normalBalanceForAccountType("Expense")).toBe("debit");
    expect(normalBalanceForAccountType("Liability")).toBe("credit");
    expect(normalBalanceForAccountType("Equity")).toBe("credit");
    expect(normalBalanceForAccountType("Revenue")).toBe("credit");
    expect(isDebitNormalAccountType("Asset")).toBe(true);
    expect(isDebitNormalAccountType("Revenue")).toBe(false);
  });

  it("narrows DB values and refuses an unknown account type", () => {
    expect(accountTypeFromDb("Revenue")).toBe("Revenue");
    expect(() => accountTypeFromDb("revenue")).toThrow(/drifted/);
    expect(() => accountTypeFromDb("")).toThrow(/drifted/);
  });
});

describe("journal lifecycle", () => {
  it("keeps the stored status set to draft/posted", () => {
    expect([...JOURNAL_ENTRY_STATUSES]).toEqual(["draft", "posted"]);
  });

  it("detects a reversal by source id or reversed ref", () => {
    const entry = { id: "e1", ref: "JE-1" };
    expect(
      isJournalEntryReversed(entry, [{ id: "r1", source_type: "reversal", source_id: "e1" }]),
    ).toBe(true);
    expect(isJournalEntryReversed(entry, [{ id: "r2", reversed_ref: "JE-1" }])).toBe(true);
    expect(
      isJournalEntryReversed(entry, [{ id: "e1", source_type: "reversal", source_id: "e1" }]),
    ).toBe(false);
    expect(
      isJournalEntryReversed(entry, [{ id: "x", source_type: "manual", source_id: "e1" }]),
    ).toBe(false);
  });
});

describe("payment methods", () => {
  it("normalizes every legacy spelling to the canonical label", () => {
    expect(normalizePaymentMethod("cash")).toBe("Cash");
    expect(normalizePaymentMethod("bank_transfer")).toBe("Bank Transfer");
    expect(normalizePaymentMethod("Bank Transfer")).toBe("Bank Transfer");
    expect(normalizePaymentMethod("CHEQUE")).toBe("Cheque");
    expect(normalizePaymentMethod("card")).toBe("Card");
    expect(normalizePaymentMethod("bitcoin")).toBe("bitcoin");
  });

  it("coerces stored rows without ever throwing", () => {
    for (const method of FINANCE_PAYMENT_METHODS) {
      expect(coerceFinancePaymentMethod(method)).toBe(method);
    }
    expect(coerceFinancePaymentMethod("unknown-method")).toBe("Other");
  });
});

describe("exchange-rate sources", () => {
  it("accepts manual, feed, estimate and identity only", () => {
    expect([...EXCHANGE_RATE_SOURCES]).toEqual(["manual", "feed", "estimate", "identity"]);
    expect(isExchangeRateSource("estimate")).toBe(true);
    expect(isExchangeRateSource("manual:inverse")).toBe(false);
    expect(coerceExchangeRateSource("feed")).toBe("feed");
    expect(coerceExchangeRateSource("legacy")).toBe("manual");
  });
});

describe("journal tags", () => {
  it("contains every tag the backend writes", () => {
    for (const tag of ["Payroll", "Reversal", "Prior Period"]) {
      expect(JOURNAL_TAGS).toContain(tag);
    }
  });
});
