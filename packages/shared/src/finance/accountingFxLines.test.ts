import { describe, expect, it } from "vitest";
import {
  JournalFxLineError,
  MissingExchangeRateError,
  isSupportedFunctionalCurrency,
  resolveJournalFxLines,
} from "./accountingFxLines.js";
import { isJournalEntryBalanced } from "./accountingLedgerInvariants.js";
import { buildReversalLines } from "./accountingLedgerPosting.js";
import type { JournalLine } from "./accountingModuleManifest.js";

const ctx = { functionalCurrency: "PKR", entryDate: "2026-10-01", roundingAccountId: "fx-round" };

const usd = (id: string, account: string, side: "debit" | "credit", amount: string, rate: string) =>
  ({
    id,
    account_id: account,
    debit: 0,
    credit: 0,
    description: "",
    txn_currency: "USD",
    txn_debit: side === "debit" ? amount : "0",
    txn_credit: side === "credit" ? amount : "0",
    exchange_rate: rate,
  }) satisfies JournalLine;

describe("resolveJournalFxLines", () => {
  it("fills functional-currency lines at rate 1", () => {
    const [line] = resolveJournalFxLines(
      [{ id: "l1", account_id: "cash", debit: 1250.5, credit: 0, description: "" }],
      ctx,
    );

    expect(line).toMatchObject({
      txn_currency: "PKR",
      txn_debit: "1250.50",
      txn_credit: "0.00",
      exchange_rate: "1",
      rate_type: "SPOT",
      rate_date: "2026-10-01",
      debit: 1250.5,
    });
  });

  it("derives functional amounts from the line rate", () => {
    const lines = resolveJournalFxLines(
      [usd("ar", "ar", "debit", "1000", "280"), usd("inc", "income", "credit", "1000", "280")],
      ctx,
    );

    expect(lines.map((l) => [l.debit, l.credit])).toEqual([
      [280000, 0],
      [0, 280000],
    ]);
    expect(isJournalEntryBalanced(lines)).toBe(true);
  });

  it("posts a sub-tolerance residue to the rounding account", () => {
    const lines = resolveJournalFxLines(
      [
        usd("d", "ar", "debit", "0.03", "280.5555"),
        usd("c1", "income", "credit", "0.01", "280.5555"),
        usd("c2", "income", "credit", "0.01", "280.5555"),
        usd("c3", "income", "credit", "0.01", "280.5555"),
      ],
      ctx,
    );

    expect(lines.at(-1)).toMatchObject({ account_id: "fx-round", debit: 0.01, credit: 0 });
    expect(isJournalEntryBalanced(lines)).toBe(true);
  });

  it("refuses to post a foreign line without a rate", () => {
    const line = { ...usd("ar", "ar", "debit", "10", "1"), exchange_rate: undefined };

    expect(() => resolveJournalFxLines([line], ctx)).toThrow(MissingExchangeRateError);
  });

  it("enforces an account's locked currency", () => {
    const accountCurrencies = new Map([["usd-bank", "USD"]]);
    const pkrLine = { id: "l", account_id: "usd-bank", debit: 5, credit: 0, description: "" };

    expect(() => resolveJournalFxLines([pkrLine], { ...ctx, accountCurrencies })).toThrow(
      JournalFxLineError,
    );
  });

  it("rejects amounts finer than the transaction currency allows", () => {
    const line = { ...usd("j", "ar", "debit", "1.5", "1.9"), txn_currency: "JPY" };

    expect(() => resolveJournalFxLines([line], ctx)).toThrow(JournalFxLineError);
  });
});

describe("buildReversalLines", () => {
  it("swaps transaction amounts with functional amounts", () => {
    const [reversed] = buildReversalLines(
      resolveJournalFxLines([usd("ar", "ar", "debit", "1000", "280")], ctx),
    );

    expect(reversed).toMatchObject({
      debit: 0,
      credit: 280000,
      txn_debit: "0.00",
      txn_credit: "1000.00",
    });
  });
});

describe("isSupportedFunctionalCurrency", () => {
  it("allows up to two decimals while ledger DTOs are numeric", () => {
    expect(isSupportedFunctionalCurrency("PKR")).toBe(true);
    expect(isSupportedFunctionalCurrency("JPY")).toBe(true);
    expect(isSupportedFunctionalCurrency("KWD")).toBe(false);
  });
});
