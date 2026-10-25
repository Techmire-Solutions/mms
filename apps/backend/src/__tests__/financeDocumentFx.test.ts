import { describe, expect, it, vi } from "vitest";
import type { AccountingFxRepository } from "../accounting/repository/accountingFxRepository.js";
import { resolveDocumentFx, resolvePaymentFx } from "../finance/use-cases/financeDocumentFx.js";

function makeFx(rate: string | null = "285"): AccountingFxRepository {
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
    lookupExchangeRate: vi.fn().mockResolvedValue(
      rate
        ? { fromCurrency: "USD", toCurrency: "PKR", rate, rateDate: "2026-10-14", rateType: "SPOT", source: "manual" }
        : null,
    ),
    findFxRoundingAccountId: vi.fn(),
    listExchangeability: vi.fn().mockResolvedValue([]),
    saveExchangeability: vi.fn(),
  };
}

const usdInvoice = { currency: "USD", exchangeRate: "280" };

describe("resolveDocumentFx", () => {
  it("given a functional-currency document, should store no FX fields", async () => {
    // Arrange / Act
    const result = await resolveDocumentFx("demo", { currency: "PKR" }, "2026-10-01", makeFx());

    // Assert
    expect(result).toEqual({});
  });

  it("given a USD document without a rate, should book the latest SPOT rate", async () => {
    // Arrange / Act
    const result = await resolveDocumentFx("demo", { currency: "USD" }, "2026-10-01", makeFx("280"));

    // Assert
    expect(result).toEqual({ currency: "USD", exchangeRate: "280" });
  });

  it("given no rate on file, should reject with 422 instead of booking at 1", async () => {
    // Arrange / Act
    const result = resolveDocumentFx("demo", { currency: "USD" }, "2026-10-01", makeFx(null));

    // Assert
    await expect(result).rejects.toMatchObject({ statusCode: 422 });
  });

  it("given a currency that is not enabled, should reject with 422", async () => {
    // Arrange / Act
    const result = resolveDocumentFx("demo", { currency: "EUR" }, "2026-10-01", makeFx());

    // Assert
    await expect(result).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe("resolvePaymentFx", () => {
  it("given a USD payment at 285 on a USD invoice booked at 280, should record a 5,000 gain", async () => {
    // Arrange / Act
    const result = await resolvePaymentFx(
      "demo",
      usdInvoice,
      { amount: 1000, date: "2026-10-15" },
      makeFx("285"),
    );

    // Assert
    expect(result).toEqual({ currency: "USD", exchangeRate: "285", invoiceAmount: 1000, realizedFx: 5000 });
  });

  it("given 285,000 PKR paid against the USD invoice, should apply 1,000 USD with the same gain", async () => {
    // Arrange / Act
    const result = await resolvePaymentFx(
      "demo",
      usdInvoice,
      { amount: 285000, date: "2026-10-15", currency: "PKR" },
      makeFx("285"),
    );

    // Assert
    expect(result).toEqual({ currency: "PKR", exchangeRate: "285", invoiceAmount: 1000, realizedFx: 5000 });
  });

  it("given a functional invoice paid in functional currency, should store no FX fields", async () => {
    // Arrange / Act
    const result = await resolvePaymentFx("demo", {}, { amount: 500, date: "2026-10-15" }, makeFx());

    // Assert
    expect(result).toEqual({});
  });

  it("given a third currency, should reject the settlement", async () => {
    // Arrange / Act
    const result = resolvePaymentFx(
      "demo",
      usdInvoice,
      { amount: 10, date: "2026-10-15", currency: "EUR" },
      makeFx(),
    );

    // Assert
    await expect(result).rejects.toMatchObject({ statusCode: 422 });
  });
});
