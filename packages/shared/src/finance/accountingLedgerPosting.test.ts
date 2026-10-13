import { describe, expect, it } from "vitest";
import { isJournalEntryBalanced } from "./accountingLedgerInvariants.js";
import {
  buildClosingEntryLines,
  buildCreditNotePostingLines,
  buildInvoicePostingLines,
  buildLateFeePostingLines,
  buildOpeningEntryLines,
  buildPaymentPostingLines,
  buildReversalLines,
  hasInvoicePostingAccounts,
  hasPaymentPostingAccounts,
} from "./accountingLedgerPosting.js";

const ACCOUNTS = {
  arAccountId: "a1100",
  cashAccountId: "a1000",
  incomeAccountId: "a4000",
  discountAccountId: "a4100",
};

describe("accountingLedgerPosting", () => {
  it("skips invoice/payment journals when posting accounts are missing", () => {
    expect(hasInvoicePostingAccounts({})).toBe(false);
    expect(hasPaymentPostingAccounts({ cashAccountId: "a1000" })).toBe(false);
    expect(
      buildInvoicePostingLines({
        invoiceId: "inv-1",
        description: "Tuition",
        date: "2026-01-01",
        finalAmt: 100,
        accounts: {},
      }),
    ).toBeNull();
  });

  it("posts invoice as Dr AR / Cr Income and optional discount", () => {
    const plain = buildInvoicePostingLines({
      invoiceId: "inv-1",
      description: "Tuition",
      date: "2026-01-01",
      finalAmt: 80,
      accounts: ACCOUNTS,
    });
    expect(plain).not.toBeNull();
    expect(isJournalEntryBalanced(plain ?? [])).toBe(true);
    expect(plain?.map((line) => [line.account_id, line.debit, line.credit])).toEqual([
      ["a1100", 80, 0],
      ["a4000", 0, 80],
    ]);

    const discounted = buildInvoicePostingLines({
      invoiceId: "inv-2",
      description: "Tuition",
      date: "2026-01-01",
      finalAmt: 80,
      discountAmt: 20,
      accounts: ACCOUNTS,
    });
    expect(isJournalEntryBalanced(discounted ?? [])).toBe(true);
    expect(discounted?.map((line) => [line.account_id, line.debit, line.credit])).toEqual([
      ["a1100", 80, 0],
      ["a4100", 20, 0],
      ["a4000", 0, 100],
    ]);
  });

  it("posts payment as Dr Cash / Cr AR", () => {
    const lines = buildPaymentPostingLines({
      paymentId: "pay-1",
      description: "Receipt",
      date: "2026-01-02",
      amount: 50,
      accounts: ACCOUNTS,
    });
    expect(isJournalEntryBalanced(lines ?? [])).toBe(true);
    expect(lines?.map((line) => [line.account_id, line.debit, line.credit])).toEqual([
      ["a1000", 50, 0],
      ["a1100", 0, 50],
    ]);
  });

  it("closes revenue and expense nets into retained earnings", () => {
    const lines = buildClosingEntryLines("a3100", [
      { accountId: "a4000", type: "Revenue", net: 200 },
      { accountId: "a5000", type: "Expense", net: 50 },
    ]);
    expect(isJournalEntryBalanced(lines ?? [])).toBe(true);
    expect(lines?.find((line) => line.account_id === "a3100")?.credit).toBe(150);
  });

  it("closes contra (negative-net) revenue and expense balances on the opposite side", () => {
    const lines = buildClosingEntryLines("a3100", [
      { accountId: "a4000", type: "Revenue", net: 200 },
      { accountId: "a4100", type: "Revenue", net: -30 },
      { accountId: "a5000", type: "Expense", net: 50 },
      { accountId: "a5100", type: "Expense", net: -20 },
    ]);
    expect(isJournalEntryBalanced(lines ?? [])).toBe(true);
    // a4100 contra-revenue (net -30 → debit balance) is credited 30; a5100
    // contra-expense (net -20 → credit balance) is debited 20.
    expect(lines?.find((line) => line.account_id === "a4100")?.credit).toBe(30);
    expect(lines?.find((line) => line.account_id === "a5100")?.debit).toBe(20);
  });

  it("returns null when there is no P&L activity to close", () => {
    expect(buildClosingEntryLines("a3100", [])).toBeNull();
    expect(
      buildClosingEntryLines("a3100", [{ accountId: "a4000", type: "Revenue", net: 0 }]),
    ).toBeNull();
  });

  it("rejects unbalanced opening balances", () => {
    expect(buildOpeningEntryLines([{ accountId: "a1000", debit: 10, credit: 0 }])).toBeNull();
    const balanced = buildOpeningEntryLines([
      { accountId: "a1000", debit: 10, credit: 0 },
      { accountId: "a3100", debit: 0, credit: 10 },
    ]);
    expect(isJournalEntryBalanced(balanced ?? [])).toBe(true);
  });

  it("reverses invoice lines and posts credit notes / late fees against AR", () => {
    const invoice = buildInvoicePostingLines({
      invoiceId: "inv-1",
      description: "Tuition",
      date: "2026-01-01",
      finalAmt: 80,
      accounts: ACCOUNTS,
    });
    const reversed = buildReversalLines(invoice ?? []);
    expect(isJournalEntryBalanced(reversed)).toBe(true);
    expect(reversed.map((line) => [line.account_id, line.debit, line.credit])).toEqual([
      ["a1100", 0, 80],
      ["a4000", 80, 0],
    ]);
    expect(
      buildCreditNotePostingLines({
        creditNoteId: "cn-1",
        amount: 20,
        description: "Credit",
        accounts: ACCOUNTS,
      })?.map((line) => [line.account_id, line.debit, line.credit]),
    ).toEqual([
      ["a4000", 20, 0],
      ["a1100", 0, 20],
    ]);
    expect(
      buildLateFeePostingLines({
        invoiceId: "inv-1",
        amount: 5,
        description: "Late fee",
        accounts: ACCOUNTS,
      })?.map((line) => [line.account_id, line.debit, line.credit]),
    ).toEqual([
      ["a1100", 5, 0],
      ["a4000", 0, 5],
    ]);
  });
});
