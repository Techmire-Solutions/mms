import { describe, expect, it } from "vitest";
import { currencyMinorUnits, isIsoCurrencyCode, UnknownCurrencyError } from "./iso4217.js";
import {
  addMoney,
  allocateMoney,
  CurrencyMismatchError,
  divideRounded,
  InvalidMoneyStringError,
  moneyToDecimalString,
  parseMoney,
  subtractMoney,
  sumMoney,
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
});
