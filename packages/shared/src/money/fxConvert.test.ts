import { describe, expect, it } from "vitest";
import {
  convertMoney,
  crossExchangeRate,
  InvalidExchangeRateError,
  invertExchangeRate,
} from "./fxConvert.js";
import { moneyToDecimalString, parseMoney, subtractMoney } from "./money.js";
import { currencyCodeSchema, exchangeRateValueSchema, moneyValueSchema } from "./moneySchemas.js";

const toPkr = (amount: string, ccy: string, rate: string): string =>
  moneyToDecimalString(convertMoney(parseMoney(amount, ccy), rate, "PKR"));

describe("convertMoney", () => {
  it("converts at the given rate", () => {
    expect(toPkr("1000", "USD", "280")).toBe("280000.00");
    expect(toPkr("0.01", "USD", "278.4567")).toBe("2.78");
  });

  it("computes realized FX as the settlement minus booked functional amount", () => {
    const booked = convertMoney(parseMoney("1000", "USD"), "280", "PKR");
    const settled = convertMoney(parseMoney("1000", "USD"), "285", "PKR");
    expect(moneyToDecimalString(subtractMoney(settled, booked))).toBe("5000.00");
  });

  it("rounds to the target currency's minor units", () => {
    expect(moneyToDecimalString(convertMoney(parseMoney("1", "USD"), "151.5", "JPY"))).toBe("152");
    expect(moneyToDecimalString(convertMoney(parseMoney("1", "USD"), "0.30715", "KWD"))).toBe(
      "0.307",
    );
    expect(moneyToDecimalString(convertMoney(parseMoney("1000", "JPY"), "1.9", "PKR"))).toBe(
      "1900.00",
    );
  });

  it("needs no rate within one currency and rejects bad rates", () => {
    const pkr = parseMoney("5", "PKR");
    expect(convertMoney(pkr, "not-a-rate", "PKR")).toBe(pkr);
    expect(() => convertMoney(parseMoney("1", "USD"), "0", "PKR")).toThrow(
      InvalidExchangeRateError,
    );
    expect(() => convertMoney(parseMoney("1", "USD"), "-1", "PKR")).toThrow(
      InvalidExchangeRateError,
    );
  });
});

describe("rate algebra", () => {
  it("inverts a rate", () => {
    expect(invertExchangeRate("4")).toBe("0.25");
    expect(invertExchangeRate("280")).toBe("0.0035714286");
  });

  it("triangulates through a base currency", () => {
    // EUR base: 1 EUR = 1.08 USD, 1 EUR = 302.4 PKR → 1 USD = 280 PKR.
    expect(crossExchangeRate("1.08", "302.4")).toBe("280");
  });
});

describe("money schemas", () => {
  it("validates codes, rates and per-currency scale", () => {
    expect(currencyCodeSchema.safeParse("PKR").success).toBe(true);
    expect(currencyCodeSchema.safeParse("pkr").success).toBe(false);
    expect(exchangeRateValueSchema.safeParse("280.12345678912").success).toBe(false);
    expect(exchangeRateValueSchema.safeParse("280.1234567891").success).toBe(true);
    expect(exchangeRateValueSchema.safeParse("280.5").success).toBe(true);
    expect(moneyValueSchema.safeParse({ amount: "10.5", currency: "JPY" }).success).toBe(false);
    expect(moneyValueSchema.safeParse({ amount: "10.500", currency: "KWD" }).success).toBe(true);
  });
});
