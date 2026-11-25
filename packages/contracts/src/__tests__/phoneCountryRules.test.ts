import { describe, expect, it } from "vitest";
import {
  COUNTRY_PHONE_RULES,
  getCountryPhoneRule,
  extractSubscriberDigits,
  validatePhoneNumberByCountry,
  clampPhoneNumberInput,
  getMaxAllowedPhoneInputLength,
  normalizeCountryDialCode,
} from "../core/phoneCountryRules.js";

describe("phoneCountryRules", () => {
  it("normalizes dial codes correctly", () => {
    expect(COUNTRY_PHONE_RULES.length).toBeGreaterThan(0);
    expect(normalizeCountryDialCode("+92")).toBe("+92");
    expect(normalizeCountryDialCode("92")).toBe("+92");
    expect(normalizeCountryDialCode("+1")).toBe("+1");
    expect(normalizeCountryDialCode("")).toBe("");
    expect(normalizeCountryDialCode(null)).toBe("");
  });

  it("finds rules by dial code and country name", () => {
    const pkRule = getCountryPhoneRule("+92");
    expect(pkRule?.country).toBe("Pakistan");
    expect(pkRule?.lengths).toEqual([10]);

    const pkByName = getCountryPhoneRule("pakistan");
    expect(pkByName?.code).toBe("+92");

    const usRule = getCountryPhoneRule("+1");
    expect(usRule?.lengths).toEqual([10]);

    const uaeRule = getCountryPhoneRule("+971");
    expect(uaeRule?.country).toBe("United Arab Emirates");
    expect(uaeRule?.lengths).toEqual([9]);

    const saRule = getCountryPhoneRule("+966");
    expect(saRule?.country).toBe("Saudi Arabia");
    expect(saRule?.lengths).toEqual([9]);

    const unknown = getCountryPhoneRule("+999");
    expect(unknown).toBeUndefined();
  });

  describe("extractSubscriberDigits", () => {
    it("extracts exact subscriber digits for Pakistan (+92)", () => {
      // 10 digits without prefix
      expect(extractSubscriberDigits("3442241024", "+92")).toEqual({
        subscriberDigits: "3442241024",
        normalizedCountryCode: "+92",
        hasLeadingZero: false,
      });

      // With national trunk 0
      expect(extractSubscriberDigits("03442241024", "+92")).toEqual({
        subscriberDigits: "3442241024",
        normalizedCountryCode: "+92",
        hasLeadingZero: true,
      });

      // With full international +92
      expect(extractSubscriberDigits("+92 344 2241024", "+92")).toEqual({
        subscriberDigits: "3442241024",
        normalizedCountryCode: "+92",
        hasLeadingZero: false,
      });

      // With dashes and spaces
      expect(extractSubscriberDigits("0344-224-1024", "+92")).toEqual({
        subscriberDigits: "3442241024",
        normalizedCountryCode: "+92",
        hasLeadingZero: true,
      });

      // Short number
      expect(extractSubscriberDigits("344224102", "+92")).toEqual({
        subscriberDigits: "344224102",
        normalizedCountryCode: "+92",
        hasLeadingZero: false,
      });
    });

    it("extracts subscriber digits for UAE (+971)", () => {
      expect(extractSubscriberDigits("501234567", "+971")).toEqual({
        subscriberDigits: "501234567",
        normalizedCountryCode: "+971",
        hasLeadingZero: false,
      });
      expect(extractSubscriberDigits("0501234567", "+971")).toEqual({
        subscriberDigits: "501234567",
        normalizedCountryCode: "+971",
        hasLeadingZero: true,
      });
    });

    it("handles empty input cleanly", () => {
      expect(extractSubscriberDigits("", "+92")).toEqual({
        subscriberDigits: "",
        normalizedCountryCode: "",
        hasLeadingZero: false,
      });
      expect(extractSubscriberDigits(null, "+92")).toEqual({
        subscriberDigits: "",
        normalizedCountryCode: "",
        hasLeadingZero: false,
      });
    });
  });

  describe("validatePhoneNumberByCountry", () => {
    it("accepts empty optional phone numbers", () => {
      const res = validatePhoneNumberByCountry("", "+92");
      expect(res.isValid).toBe(true);
      expect(res.subscriberDigits).toBe("");
    });

    it("accepts valid exact 10-digit Pakistani numbers (+92)", () => {
      expect(validatePhoneNumberByCountry("3442241024", "+92").isValid).toBe(true);
      expect(validatePhoneNumberByCountry("03442241024", "+92").isValid).toBe(true);
      expect(validatePhoneNumberByCountry("+92 344 2241024", "+92").isValid).toBe(true);
      expect(validatePhoneNumberByCountry("+923442241024", "+92").isValid).toBe(true);
    });

    it("rejects invalid short or long Pakistani numbers (+92)", () => {
      // 9 digits (short)
      const shortRes = validatePhoneNumberByCountry("344224102", "+92");
      expect(shortRes.isValid).toBe(false);
      expect(shortRes.digitCount).toBe(9);
      expect(shortRes.error).toBe("Pakistan (+92) phone number must be exactly 10 digits");

      // 9 digits with trunk 0
      const shortWithZero = validatePhoneNumberByCountry("0344224102", "+92");
      expect(shortWithZero.isValid).toBe(false);
      expect(shortWithZero.digitCount).toBe(9);

      // 11 digits (long)
      const longRes = validatePhoneNumberByCountry("34422410245", "+92");
      expect(longRes.isValid).toBe(false);
      expect(longRes.digitCount).toBe(11);
      expect(longRes.error).toBe("Pakistan (+92) phone number must be exactly 10 digits");
    });

    it("validates United States / Canada (+1) exact 10 digits", () => {
      expect(validatePhoneNumberByCountry("2025550143", "+1").isValid).toBe(true);
      expect(validatePhoneNumberByCountry("+1 202 555 0143", "+1").isValid).toBe(true);
      expect(validatePhoneNumberByCountry("202555014", "+1").isValid).toBe(false);
      expect(validatePhoneNumberByCountry("20255501439", "+1").isValid).toBe(false);
    });

    it("validates United Arab Emirates (+971) exact 9 digits", () => {
      expect(validatePhoneNumberByCountry("501234567", "+971").isValid).toBe(true);
      expect(validatePhoneNumberByCountry("0501234567", "+971").isValid).toBe(true);
      expect(validatePhoneNumberByCountry("+971 50 123 4567", "+971").isValid).toBe(true);
      expect(validatePhoneNumberByCountry("50123456", "+971").isValid).toBe(false);
      expect(validatePhoneNumberByCountry("5012345678", "+971").isValid).toBe(false);
    });

    it("validates Saudi Arabia (+966) exact 9 digits", () => {
      expect(validatePhoneNumberByCountry("501234567", "+966").isValid).toBe(true);
      expect(validatePhoneNumberByCountry("0501234567", "+966").isValid).toBe(true);
      expect(validatePhoneNumberByCountry("50123456", "+966").isValid).toBe(false);
      expect(validatePhoneNumberByCountry("5012345678", "+966").isValid).toBe(false);
    });

    it("validates India (+91) exact 10 digits", () => {
      expect(validatePhoneNumberByCountry("9876543210", "+91").isValid).toBe(true);
      expect(validatePhoneNumberByCountry("987654321", "+91").isValid).toBe(false);
      expect(validatePhoneNumberByCountry("98765432101", "+91").isValid).toBe(false);
    });

    it("validates United Kingdom (+44) exact 10 digits", () => {
      expect(validatePhoneNumberByCountry("7700900077", "+44").isValid).toBe(true);
      expect(validatePhoneNumberByCountry("07700900077", "+44").isValid).toBe(true);
      expect(validatePhoneNumberByCountry("770090007", "+44").isValid).toBe(false);
    });

    it("supports custom translation function", () => {
      const mockT = (key: string, params?: Record<string, unknown>) =>
        `TRANSLATED: ${key} ${JSON.stringify(params)}`;
      const res = validatePhoneNumberByCountry("344224102", "+92", { t: mockT });
      expect(res.isValid).toBe(false);
      expect(res.error).toBe(
        'TRANSLATED: contacts.validation.phoneDigitsExact {"country":"Pakistan","code":"+92","expected":"10"}',
      );
    });
  });

  describe("clampPhoneNumberInput", () => {
    it("clamps subscriber digits to 10 for Pakistan (+92)", () => {
      // 10 digits stays 10 digits
      expect(clampPhoneNumberInput("3442241024", "+92")).toBe("3442241024");

      // 11th digit is blocked
      expect(clampPhoneNumberInput("34422410245", "+92")).toBe("3442241024");

      // With trunk 0, allows 0 + 10 digits = 11 characters
      expect(clampPhoneNumberInput("03442241024", "+92")).toBe("03442241024");

      // 12th character after 0 is blocked
      expect(clampPhoneNumberInput("034422410245", "+92")).toBe("03442241024");
    });

    it("clamps for UAE (+971) exact 9 digits", () => {
      expect(clampPhoneNumberInput("501234567", "+971")).toBe("501234567");
      expect(clampPhoneNumberInput("5012345678", "+971")).toBe("501234567");
    });
  });

  describe("getMaxAllowedPhoneInputLength", () => {
    it("returns correct maximum length including separator buffer", () => {
      expect(getMaxAllowedPhoneInputLength("344", "+92")).toBe(14); // 10 + 4
      expect(getMaxAllowedPhoneInputLength("0344", "+92")).toBe(15); // 10 + 1 + 4
      expect(getMaxAllowedPhoneInputLength("501", "+971")).toBe(13); // 9 + 4
    });
  });
});
