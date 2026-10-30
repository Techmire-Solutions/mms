import { describe, expect, it } from "vitest";
import {
  formatAmountInWords,
  formatMoney,
  formatNumber,
  formatPercent,
  registerFinanceLocaleProvider,
} from "./moneyFormatUtils.js";

describe("formatAmountInWords", () => {
  it("formats zero correctly", () => {
    expect(formatAmountInWords(0, "USD")).toBe("Zero USD Only");
    expect(formatAmountInWords(0)).toBe("Zero Only");
  });

  it("formats standard integers", () => {
    expect(formatAmountInWords(5, "USD")).toBe("Five USD Only");
    expect(formatAmountInWords(25, "USD")).toBe("Twenty Five USD Only");
    expect(formatAmountInWords(100, "USD")).toBe("One Hundred USD Only");
    expect(formatAmountInWords(1250, "PKR")).toBe("One Thousand Two Hundred Fifty PKR Only");
    expect(formatAmountInWords(1000000, "USD")).toBe("One Million USD Only");
  });

  it("formats decimal amounts with fractional cents", () => {
    expect(formatAmountInWords(500.5, "USD")).toBe("Five Hundred and 50/100 USD Only");
    expect(formatAmountInWords("1250.75", "GBP")).toBe(
      "One Thousand Two Hundred Fifty and 75/100 GBP Only",
    );
    expect(formatAmountInWords(0.999, "USD")).toBe("One USD Only");
  });

  it("handles negative numbers", () => {
    expect(formatAmountInWords(-250, "USD")).toBe("Minus Two Hundred Fifty USD Only");
  });

  it("returns empty string on null, undefined, or invalid numbers", () => {
    expect(formatAmountInWords(null)).toBe("");
    expect(formatAmountInWords(undefined)).toBe("");
    expect(formatAmountInWords("not-a-number")).toBe("");
  });
});

describe("formatMoney and formatNumber", () => {
  it("formats standard currency string", () => {
    expect(formatMoney(1250, "USD")).toBe("USD 1,250");
    expect(formatMoney(null)).toBe("—");
  });

  it("formats number safely", () => {
    expect(formatNumber(1250)).toBe("1,250");
    expect(formatNumber(null)).toBe("0");
  });

  it("formats percentages with the active locale numbering system", () => {
    registerFinanceLocaleProvider(() => "ar-SA");
    try {
      expect(formatPercent(100)).toMatch(/[\u0660-\u0669]/);
      expect(formatPercent(12.5, { maximumFractionDigits: 1 })).toContain("٪");
      expect(formatPercent(5, { signDisplay: "always" })).toContain("+");
    } finally {
      registerFinanceLocaleProvider(null);
    }
  });

  it("defaults the maximum decimals to the currency's ISO minor units", () => {
    expect(formatMoney(1250.567, "USD")).toBe("USD 1,250.57");
    expect(formatMoney(1250.567, "JPY")).toBe("JPY 1,251");
    expect(formatMoney(1.2345, "KWD")).toBe("KWD 1.235");
    expect(formatMoney(1, "JPY", { minimumFractionDigits: 2 })).toBe("JPY 1.00");
  });
});
