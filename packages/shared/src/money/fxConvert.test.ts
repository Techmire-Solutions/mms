import { describe, expect, it } from "vitest";
import {
  convertMoney,
  crossExchangeRate,
  InvalidExchangeRateError,
  invertExchangeRate,
  isValidExchangeRate,
  previewConvertedAmount,
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
    expect(crossExchangeRate("1", "2")).toBe("2");
  });

  it("validates rate syntax and the stored 10-decimal scale", () => {
    expect(isValidExchangeRate("1")).toBe(true);
    expect(isValidExchangeRate("0.0000000001")).toBe(true);
    expect(isValidExchangeRate("280.1234567891")).toBe(true);
    expect(isValidExchangeRate("0.00000000001")).toBe(false);
    expect(isValidExchangeRate("280.12345678912")).toBe(false);
    for (const bad of ["", "abc", "0", "-1", "1e3", "1.", ".5", "1,5", " 1 2 "]) {
      expect(isValidExchangeRate(bad)).toBe(false);
      expect(() => convertMoney(parseMoney("1", "USD"), bad, "PKR")).toThrow(
        InvalidExchangeRateError,
      );
    }
  });

  it("trims trailing zeros from derived rates", () => {
    expect(invertExchangeRate("2")).toBe("0.5");
    expect(invertExchangeRate("1")).toBe("1");
  });
});

describe("previewConvertedAmount", () => {
  it("converts at the rate and passes same-currency amounts through", () => {
    expect(previewConvertedAmount(100, "USD", "PKR", "280")).toBe(28000);
    expect(previewConvertedAmount(12.34, "USD", "USD", "not-a-rate")).toBe(12.34);
  });

  it("returns null while the rate is unusable", () => {
    expect(previewConvertedAmount(1, "USD", "PKR", "abc")).toBeNull();
    expect(previewConvertedAmount(1, "USD", "PKR", "0")).toBeNull();
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
