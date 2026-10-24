import { describe, expect, it, vi } from "vitest";
import type { Account, JournalEntry } from "@mms/shared";
import type { AccountingRepository } from "../accounting/repository/accountingRepository.js";
import type { AccountingFxRepository } from "../accounting/repository/accountingFxRepository.js";
import { resolveEntriesFx } from "../accounting/use-cases/journalEntryFx.js";

function makeFx(overrides: Partial<AccountingFxRepository> = {}): AccountingFxRepository {
  return {
    getCurrencySettings: vi.fn().mockResolvedValue({
      functionalCurrency: "PKR",
      presentationCurrency: "PKR",
      locked: true,
      enabledCurrencies: ["USD"],
    }),
    saveCurrencySettings: vi.fn(),
    listExchangeRates: vi.fn(),
    upsertExchangeRates: vi.fn(),
    lookupExchangeRate: vi.fn().mockResolvedValue({
      fromCurrency: "USD",
      toCurrency: "PKR",
      rate: "280",
      rateDate: "2026-09-30",
      rateType: "SPOT",
      source: "manual",
    }),
    findFxRoundingAccountId: vi.fn().mockResolvedValue("fx-round"),
    ...overrides,
  };
}

function makeRepo(fx: AccountingFxRepository | undefined, accounts: Account[] = []) {
  return {
    fx,
    findAccountsByIds: vi.fn().mockResolvedValue(accounts),
  } as unknown as AccountingRepository;
}

const entry = (lines: JournalEntry["lines"]): JournalEntry =>
  ({ id: "je-1", date: "2026-10-01", status: "posted", lines }) as JournalEntry;

const usdLine = (id: string, account: string, side: "debit" | "credit", currency = "USD") => ({
  id,
  account_id: account,
  debit: 0,
  credit: 0,
  description: "",
  txn_currency: currency,
  txn_debit: side === "debit" ? "1000" : "0",
  txn_credit: side === "credit" ? "1000" : "0",
});

describe("resolveEntriesFx", () => {
  it("given a foreign line without a rate, should default the latest SPOT rate on or before the entry date", async () => {
    // Arrange
    const fx = makeFx();

    // Act
    const [resolved] = await resolveEntriesFx(makeRepo(fx), "demo", [
      entry([usdLine("ar", "ar", "debit"), usdLine("inc", "income", "credit")]),
    ]);

    // Assert
    expect(fx.lookupExchangeRate).toHaveBeenCalledTimes(1);
    expect(fx.lookupExchangeRate).toHaveBeenCalledWith("demo", {
      fromCurrency: "USD",
      toCurrency: "PKR",
      date: "2026-10-01",
      rateType: "SPOT",
    });
    expect(resolved.lines.map((line) => [line.debit, line.credit, line.exchange_rate])).toEqual([
      [280000, 0, "280"],
      [0, 280000, "280"],
    ]);
  });

  it("given no rate on file, should fail with a 422 instead of booking at 1", async () => {
    // Arrange
    const fx = makeFx({ lookupExchangeRate: vi.fn().mockResolvedValue(null) });

    // Act
    const result = resolveEntriesFx(makeRepo(fx), "demo", [entry([usdLine("ar", "ar", "debit")])]);

    // Assert
    await expect(result).rejects.toMatchObject({ statusCode: 422, type: "validation_error" });
  });

  it("given a currency the workspace has not enabled, should fail with a 422", async () => {
    // Arrange / Act
    const result = resolveEntriesFx(makeRepo(makeFx()), "demo", [
      entry([usdLine("ar", "ar", "debit", "EUR")]),
    ]);

    // Assert
    await expect(result).rejects.toMatchObject({ statusCode: 422 });
  });

  it("given a PKR line on a USD-locked bank account, should fail with a 422", async () => {
    // Arrange
    const bank = { id: "usd-bank", accountCurrency: "USD" } as Account;
    const line = { id: "l", account_id: "usd-bank", debit: 5, credit: 0, description: "" };

    // Act
    const result = resolveEntriesFx(makeRepo(makeFx(), [bank]), "demo", [entry([line])]);

    // Assert
    await expect(result).rejects.toMatchObject({ statusCode: 422 });
  });

  it("given a repository without FX support, should leave entries unchanged", async () => {
    // Arrange
    const original = entry([{ id: "l", account_id: "cash", debit: 5, credit: 0, description: "" }]);

    // Act
    const [resolved] = await resolveEntriesFx(makeRepo(undefined), "demo", [original]);

    // Assert
    expect(resolved).toBe(original);
  });
});
