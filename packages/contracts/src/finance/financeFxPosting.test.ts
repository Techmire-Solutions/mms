import { describe, expect, it } from "vitest";
import { moneyToDecimalString } from "../money/money.js";
import { isJournalEntryBalanced } from "./accountingLedgerInvariants.js";
import { buildInvoicePostingLines } from "./accountingLedgerPosting.js";
import {
  MissingFxAccountError,
  UnsupportedSettlementError,
  settlementInvoiceAmount,
  buildFxPaymentPostingLines,
  computeRealizedFx,
  stampDocumentFxLines,
} from "./financeFxPosting.js";

const accounts = {
  arAccountId: "ar",
  cashAccountId: "cash",
  incomeAccountId: "inc",
  fxRealizedAccountId: "fx",
};

const payment = (amount: number, settlementRate: string) => ({
  paymentId: "p1",
  description: "Fee",
  date: "2026-10-15",
  amount,
  paymentCurrency: "USD",
  invoiceAmount: amount,
  invoiceCurrency: "USD",
  functionalCurrency: "PKR",
  bookedRate: "280",
  settlementRate,
  accounts,
});

describe("stampDocumentFxLines", () => {
  it("given a USD invoice at 280, should post 1,000 USD as 280,000 PKR on both sides", () => {
    // Arrange
    const lines = buildInvoicePostingLines({
      invoiceId: "i1",
      description: "Fee",
      date: "2026-10-01",
      finalAmt: 1000,
      accounts,
    });

    // Act
    const stamped = stampDocumentFxLines(lines ?? [], {
      currency: "USD",
      functionalCurrency: "PKR",
      rate: "280",
      entryDate: "2026-10-01",
    });

    // Assert
    expect(
      stamped.map((l) => [l.account_id, l.debit, l.credit, l.txn_debit, l.txn_credit]),
    ).toEqual([
      ["ar", 280000, 0, "1000.00", "0.00"],
      ["inc", 0, 280000, "0.00", "1000.00"],
    ]);
  });

  it("given a functional-currency invoice, should leave the lines untouched", () => {
    // Arrange
    const lines =
      buildInvoicePostingLines({
        invoiceId: "i1",
        description: "",
        date: "2026-10-01",
        finalAmt: 50,
        accounts,
      }) ?? [];

    // Act
    const stamped = stampDocumentFxLines(lines, {
      currency: "PKR",
      functionalCurrency: "PKR",
      rate: "1",
      entryDate: "2026-10-01",
    });

    // Assert
    expect(stamped).toEqual(lines);
  });
});

describe("buildFxPaymentPostingLines", () => {
  it("given an invoice booked at 280 paid at 285, should book a 5,000 PKR realized gain", () => {
    // Arrange / Act
    const lines = buildFxPaymentPostingLines(payment(1000, "285")) ?? [];

    // Assert
    expect(lines.map((l) => [l.account_id, l.debit, l.credit])).toEqual([
      ["cash", 285000, 0],
      ["ar", 0, 280000],
      ["fx", 0, 5000],
    ]);
    expect(isJournalEntryBalanced(lines)).toBe(true);
  });

  it("given a partial 400 USD payment at 275, should release 400 at the booked rate and book a loss", () => {
    // Arrange / Act
    const lines = buildFxPaymentPostingLines(payment(400, "275")) ?? [];

    // Assert
    expect(lines.map((l) => [l.account_id, l.debit, l.credit])).toEqual([
      ["cash", 110000, 0],
      ["ar", 0, 112000],
      ["fx", 2000, 0],
    ]);
    expect(isJournalEntryBalanced(lines)).toBe(true);
  });

  it("given the same rate, should post no FX line", () => {
    // Arrange / Act
    const lines = buildFxPaymentPostingLines(payment(1000, "280")) ?? [];

    // Assert
    expect(lines.map((l) => l.account_id)).toEqual(["cash", "ar"]);
  });

  it("given realized FX without a gain/loss account, should refuse instead of posting unbalanced", () => {
    // Arrange
    const input = { ...payment(1000, "285"), accounts: { ...accounts, fxRealizedAccountId: null } };

    // Act / Assert
    expect(() => buildFxPaymentPostingLines(input)).toThrow(MissingFxAccountError);
  });
});

describe("computeRealizedFx", () => {
  it("given rates that round per cent, should compare rounded functional amounts", () => {
    // Arrange / Act
    const realized = computeRealizedFx({
      amount: 0.01,
      paymentCurrency: "USD",
      invoiceAmount: 0.01,
      invoiceCurrency: "USD",
      functionalCurrency: "PKR",
      bookedRate: "280.004",
      settlementRate: "280.006",
    });

    // Assert
    expect(moneyToDecimalString(realized)).toBe("0.00");
  });
});

describe("cross-currency settlement", () => {
  it("given a USD invoice booked at 280 paid with 285,000 PKR at 285, should apply 1,000 USD and book a 5,000 gain", () => {
    // Arrange
    const invoiceAmount = settlementInvoiceAmount({
      amount: 285000,
      paymentCurrency: "PKR",
      invoiceCurrency: "USD",
      functionalCurrency: "PKR",
      settlementRate: "285",
    });

    // Act
    const lines =
      buildFxPaymentPostingLines({
        ...payment(285000, "285"),
        paymentCurrency: "PKR",
        invoiceAmount,
      }) ?? [];

    // Assert
    expect(invoiceAmount).toBe(1000);
    expect(lines.map((l) => [l.account_id, l.debit, l.credit, l.txn_currency])).toEqual([
      ["cash", 285000, 0, "PKR"],
      ["ar", 0, 280000, "USD"],
      ["fx", 0, 5000, "PKR"],
    ]);
    expect(isJournalEntryBalanced(lines)).toBe(true);
  });

  it("given a PKR invoice paid in USD, should convert at the settlement rate with no FX", () => {
    // Arrange
    const invoiceAmount = settlementInvoiceAmount({
      amount: 100,
      paymentCurrency: "USD",
      invoiceCurrency: "PKR",
      functionalCurrency: "PKR",
      settlementRate: "281",
    });

    // Act
    const lines =
      buildFxPaymentPostingLines({
        ...payment(100, "281"),
        invoiceCurrency: "PKR",
        invoiceAmount,
        bookedRate: "1",
      }) ?? [];

    // Assert
    expect(invoiceAmount).toBe(28100);
    expect(lines.map((l) => [l.account_id, l.debit, l.credit])).toEqual([
      ["cash", 28100, 0],
      ["ar", 0, 28100],
    ]);
  });

  it("given two foreign currencies, should refuse the settlement", () => {
    // Arrange / Act / Assert
    expect(() =>
      settlementInvoiceAmount({
        amount: 10,
        paymentCurrency: "EUR",
        invoiceCurrency: "USD",
        functionalCurrency: "PKR",
        settlementRate: "300",
      }),
    ).toThrow(UnsupportedSettlementError);
  });
});
