import { describe, expect, it } from "vitest";
import { currencyMinorUnits, isIsoCurrencyCode, UnknownCurrencyError } from "./iso4217.js";
import {
  addMoney,
  allocateMoney,
  compareMoney,
  CurrencyMismatchError,
  divideRounded,
  InvalidMoneyStringError,
  isZeroMoney,
  isValidMoneyString,
  moneyFromMinor,
  moneyToDecimalString,
  negateMoney,
  parseMoney,
  subtractMoney,
  sumMoney,
  zeroMoney,
} from "./money.js";

describe("iso4217", () => {
  it("knows minor units for 0, 2 and 3 decimal currencies", () => {
    expect(currencyMinorUnits("JPY")).toBe(0);
    expect(currencyMinorUnits("PKR")).toBe(2);
    expect(currencyMinorUnits("KWD")).toBe(3);
  });

  it("rejects unknown codes", () => {
    expect(isIsoCurrencyCode("XYZ")).toBe(false);
    expect(() => currencyMinorUnits("XYZ")).toThrow(UnknownCurrencyError);
  });
});

describe("parseMoney / moneyToDecimalString", () => {
  it("round-trips per currency scale", () => {
    expect(moneyToDecimalString(parseMoney("1250.5", "USD"))).toBe("1250.50");
    expect(moneyToDecimalString(parseMoney("1250", "JPY"))).toBe("1250");
    expect(moneyToDecimalString(parseMoney("0.005", "KWD"))).toBe("0.005");
    expect(moneyToDecimalString(parseMoney("-0.07", "USD"))).toBe("-0.07");
  });

  it("stores exact minor units", () => {
    expect(parseMoney("0.1", "USD").minor + parseMoney("0.2", "USD").minor).toBe(30n);
  });

  it("rejects excess decimals instead of rounding", () => {
    expect(() => parseMoney("10.5", "JPY")).toThrow(InvalidMoneyStringError);
    expect(() => parseMoney("1.001", "USD")).toThrow(InvalidMoneyStringError);
    expect(() => parseMoney("1e3", "USD")).toThrow(InvalidMoneyStringError);
  });

  it("rejects malformed amounts and accepts a trimmed sign", () => {
    for (const value of ["", "abc", "1.2.3", ".5", "1,000", "1.", "--1", "1 2", "١٢٣"]) {
      expect(isValidMoneyString(value, "USD")).toBe(false);
      expect(() => parseMoney(value, "USD")).toThrow(InvalidMoneyStringError);
    }
    expect(isValidMoneyString(" 12.30 ", "USD")).toBe(true);
    expect(moneyToDecimalString(parseMoney(" 12.30 ", "USD"))).toBe("12.30");
    expect(moneyToDecimalString(parseMoney("-0.00", "USD"))).toBe("0.00");
    expect(parseMoney("0.0001", "CLF").minor).toBe(1n);
    expect(moneyToDecimalString(parseMoney("0.0001", "CLF"))).toBe("0.0001");
    expect(moneyToDecimalString(parseMoney("-3", "JPY"))).toBe("-3");
  });

  it("constructs money only for known ISO 4217 currencies", () => {
    expect(moneyFromMinor(123n, "PKR").minor).toBe(123n);
    expect(isZeroMoney(zeroMoney("JPY"))).toBe(true);
    expect(() => moneyFromMinor(0n, "XYZ")).toThrow(UnknownCurrencyError);
    expect(() => zeroMoney("XYZ")).toThrow(UnknownCurrencyError);
  });
});

describe("arithmetic", () => {
  it("adds and subtracts in one currency", () => {
    const total = addMoney(parseMoney("10.10", "USD"), parseMoney("0.25", "USD"));
    expect(moneyToDecimalString(total)).toBe("10.35");
    expect(moneyToDecimalString(subtractMoney(total, parseMoney("20", "USD")))).toBe("-9.65");
    expect(moneyToDecimalString(sumMoney([], "PKR"))).toBe("0.00");
  });

  it("refuses to mix currencies", () => {
    expect(() => addMoney(parseMoney("1", "USD"), parseMoney("1", "EUR"))).toThrow(
      CurrencyMismatchError,
    );
    expect(() => subtractMoney(parseMoney("1", "USD"), parseMoney("1", "EUR"))).toThrow(
      CurrencyMismatchError,
    );
    expect(() => compareMoney(parseMoney("1", "USD"), parseMoney("1", "EUR"))).toThrow(
      CurrencyMismatchError,
    );
    expect(() => sumMoney([parseMoney("1", "USD"), parseMoney("1", "EUR")], "USD")).toThrow(
      CurrencyMismatchError,
    );
  });

  it("compares, negates and detects zero", () => {
    expect(compareMoney(parseMoney("1", "USD"), parseMoney("2", "USD"))).toBe(-1);
    expect(compareMoney(parseMoney("2", "USD"), parseMoney("2", "USD"))).toBe(0);
    expect(compareMoney(parseMoney("3", "USD"), parseMoney("2", "USD"))).toBe(1);
    expect(moneyToDecimalString(negateMoney(parseMoney("-3.50", "USD")))).toBe("3.50");
    expect(moneyToDecimalString(negateMoney(parseMoney("0.00", "USD")))).toBe("0.00");
    expect(isZeroMoney(parseMoney("0.01", "USD"))).toBe(false);
  });
});

describe("divideRounded", () => {
  it("rounds half-up away from zero", () => {
    expect(divideRounded(5n, 2n)).toBe(3n);
    expect(divideRounded(-5n, 2n)).toBe(-3n);
    expect(divideRounded(4n, 3n)).toBe(1n);
  });

  it("rounds half-even to the even neighbour", () => {
    expect(divideRounded(5n, 2n, "half-even")).toBe(2n);
    expect(divideRounded(7n, 2n, "half-even")).toBe(4n);
    expect(divideRounded(-5n, 2n, "half-even")).toBe(-2n);
    expect(divideRounded(-7n, 2n, "half-even")).toBe(-4n);
    expect(divideRounded(1n, 2n, "half-even")).toBe(0n);
    expect(divideRounded(-1n, 2n, "half-even")).toBe(0n);
  });

  it("returns exact quotients and rejects non-positive denominators", () => {
    expect(divideRounded(10n, 5n)).toBe(2n);
    expect(divideRounded(9n, 3n)).toBe(3n);
    expect(divideRounded(0n, 7n)).toBe(0n);
    expect(() => divideRounded(1n, 0n)).toThrow(RangeError);
    expect(() => divideRounded(1n, -2n)).toThrow(RangeError);
  });
});

describe("allocateMoney", () => {
  it("splits without losing a minor unit", () => {
    const parts = allocateMoney(parseMoney("100.00", "USD"), [1n, 1n, 1n]);
    expect(parts.map(moneyToDecimalString)).toEqual(["33.34", "33.33", "33.33"]);
  });

  it("releases a booked amount pro rata (400 of 1000)", () => {
    const [released, remaining] = allocateMoney(parseMoney("280000.00", "PKR"), [400n, 600n]);
    expect(moneyToDecimalString(released)).toBe("112000.00");
    expect(moneyToDecimalString(remaining)).toBe("168000.00");
  });

  it("rejects empty, zero-sum and negative weight sets", () => {
    expect(() => allocateMoney(parseMoney("1", "USD"), [])).toThrow(RangeError);
    expect(() => allocateMoney(parseMoney("1", "USD"), [0n, 0n])).toThrow(RangeError);
    expect(() => allocateMoney(parseMoney("1", "USD"), [1n, -1n])).toThrow(RangeError);
  });

  it("keeps a negative total exact and allocates a single weight", () => {
    const [all] = allocateMoney(parseMoney("-5.00", "USD"), [1n]);
    expect(moneyToDecimalString(all)).toBe("-5.00");

    const parts = allocateMoney(parseMoney("-0.05", "USD"), [1n, 1n]);
    expect(parts.map(moneyToDecimalString)).toEqual(["-0.03", "-0.02"]);

    const even = allocateMoney(parseMoney("0.04", "USD"), [1n, 1n]);
    expect(even.map(moneyToDecimalString)).toEqual(["0.02", "0.02"]);
  });
});
