import { describe, expect, it } from "vitest";
import { moneyNumberAmountSchema, toMoneyNumber } from "./moneySchemas.js";

describe("moneyNumberAmountSchema", () => {
  it("accepts a 2-dp number", () => {
    for (const value of [0, 0.01, 1234.56, 9_999_999_999.99]) {
      expect(moneyNumberAmountSchema.safeParse(value).success, String(value)).toBe(true);
    }
  });

  it("accepts representational float noise that still rounds to the same 2 dp", () => {
    // 0.1 + 0.2 is 0.30000000000000004. That is not a *wrong* amount — it rounds to the same
    // 2 dp the column stores — so the epsilon accepts it. The refine only rejects values whose
    // 2-dp rounding would actually change.
    const value = 0.1 + 0.2;
    expect(moneyNumberAmountSchema.safeParse(value).success).toBe(true);
    expect(Math.round(value * 100) / 100).toBe(0.3);
  });

  it("rejects a float that would be re-rounded by a numeric(12,2) column", () => {
    expect(moneyNumberAmountSchema.safeParse(1.005).success).toBe(false);
    expect(moneyNumberAmountSchema.safeParse(10.123).success).toBe(false);
  });

  it("rejects a negative amount, NaN and Infinity", () => {
    expect(moneyNumberAmountSchema.safeParse(-1).success).toBe(false);
    expect(moneyNumberAmountSchema.safeParse(Number.NaN).success).toBe(false);
    expect(moneyNumberAmountSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
  });

  it("rejects an amount whose cents cannot be represented exactly", () => {
    // Beyond 2^53 cents `Number` drops a cent, so the DTO has to become a decimal string first.
    expect(moneyNumberAmountSchema.safeParse(1e15 + 0.01).success).toBe(false);
  });
});

describe("toMoneyNumber", () => {
  it("takes a finite number and a 2-dp string to the same value", () => {
    expect(toMoneyNumber(1250.5)).toBe(1250.5);
    expect(toMoneyNumber("1250.50")).toBe(1250.5);
    expect(toMoneyNumber("1250")).toBe(1250);
    expect(toMoneyNumber("-42.25")).toBe(-42.25);
  });

  it("never produces float noise from decimal parts", () => {
    // The whole reason the helper parses digits instead of floating: 0.1 + 0.2 is not 0.3.
    expect(toMoneyNumber("0.1")).toBe(0.1);
    expect(toMoneyNumber("0.2")).toBe(0.2);
    expect(toMoneyNumber("0.1")! + toMoneyNumber("0.2")!).toBeCloseTo(0.3, 10);
    expect(toMoneyNumber("1234567890123.45")).toBe(1234567890123.45);
  });

  it.each(["", "  ", "abc", "1.005", "1,250.50", "NaN", "Infinity", null, undefined, {}, []])(
    "returns null for %s",
    (value) => {
      expect(toMoneyNumber(value)).toBeNull();
    },
  );

  it("returns null for a float that would be re-rounded", () => {
    expect(toMoneyNumber(1.005)).toBeNull();
    expect(toMoneyNumber(Number.NaN)).toBeNull();
    expect(toMoneyNumber(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("returns null when cents exceed the safe integer range", () => {
    expect(toMoneyNumber("999999999999999.99")).toBeNull();
  });
});
