import { describe, expect, it } from "vitest";
import { validateContactDraftErrors } from "../../hooks/contactFormDraftValidator";
import {
  clampPhoneNumberInput,
  extractSubscriberDigits,
  validatePhoneNumberByCountry,
  type Contact,
} from "@mms/contracts";

describe("Contact Phone Country-Specific Digit Length Validation", () => {
  const t = (key: string, params?: Record<string, unknown>) => {
    if (key === "contacts.validation.phoneDigitsExact") {
      return `${String(params?.country)} (${String(params?.code)}) phone number must be exactly ${String(params?.expected)} digits`;
    }
    if (key === "contacts.validation.phoneDigitsRange") {
      return `${String(params?.country)} (${String(params?.code)}) phone number must be between ${String(params?.min)} and ${String(params?.max)} digits`;
    }
    return key;
  };

  const isFieldRequired = () => false;
  const validateBase = () => [];

  it("extracts exact 10 subscriber digits for Pakistan (+92) stripping spaces, dashes and leading zeros", () => {
    expect(extractSubscriberDigits("3442241024", "+92").subscriberDigits).toBe("3442241024");
    expect(extractSubscriberDigits("03442241024", "+92").subscriberDigits).toBe("3442241024");
    expect(extractSubscriberDigits("+92 344 2241024", "+92").subscriberDigits).toBe("3442241024");
    expect(extractSubscriberDigits("0344-224-1024", "+92").subscriberDigits).toBe("3442241024");
  });

  it("validates exact 10 digits for Pakistan (+92) and blocks short/long numbers", () => {
    // Valid 10-digit number
    const valid = validatePhoneNumberByCountry("3442241024", "+92", { t });
    expect(valid.isValid).toBe(true);

    // Invalid short number (9 digits: +92 344224102)
    const shortNum = validatePhoneNumberByCountry("344224102", "+92", { t });
    expect(shortNum.isValid).toBe(false);
    expect(shortNum.error).toBe("Pakistan (+92) phone number must be exactly 10 digits");

    // Invalid short number with leading zero (0344224102)
    const shortWithZero = validatePhoneNumberByCountry("0344224102", "+92", { t });
    expect(shortWithZero.isValid).toBe(false);
    expect(shortWithZero.error).toBe("Pakistan (+92) phone number must be exactly 10 digits");

    // Invalid extra-digit number (11 digits: 34422410245)
    const longNum = validatePhoneNumberByCountry("34422410245", "+92", { t });
    expect(longNum.isValid).toBe(false);
    expect(longNum.error).toBe("Pakistan (+92) phone number must be exactly 10 digits");
  });

  it("validates exact digit lengths for other countries (US +1, UAE +971, SA +966)", () => {
    // US (+1) requires exact 10 digits
    expect(validatePhoneNumberByCountry("2025550143", "+1", { t }).isValid).toBe(true);
    expect(validatePhoneNumberByCountry("202555014", "+1", { t }).isValid).toBe(false);

    // UAE (+971) requires exact 9 digits
    expect(validatePhoneNumberByCountry("501234567", "+971", { t }).isValid).toBe(true);
    expect(validatePhoneNumberByCountry("0501234567", "+971", { t }).isValid).toBe(true);
    expect(validatePhoneNumberByCountry("50123456", "+971", { t }).isValid).toBe(false);

    // Saudi Arabia (+966) requires exact 9 digits
    expect(validatePhoneNumberByCountry("501234567", "+966", { t }).isValid).toBe(true);
    expect(validatePhoneNumberByCountry("50123456", "+966", { t }).isValid).toBe(false);
  });

  it("clamps phone number inputs to avoid typing or pasting beyond maximum digits", () => {
    // Pakistan (+92): max 10 subscriber digits
    expect(clampPhoneNumberInput("3442241024", "+92")).toBe("3442241024");
    expect(clampPhoneNumberInput("34422410245", "+92")).toBe("3442241024");
    expect(clampPhoneNumberInput("03442241024", "+92")).toBe("03442241024");
    expect(clampPhoneNumberInput("034422410245", "+92")).toBe("03442241024");

    // UAE (+971): max 9 subscriber digits
    expect(clampPhoneNumberInput("501234567", "+971")).toBe("501234567");
    expect(clampPhoneNumberInput("5012345678", "+971")).toBe("501234567");
  });

  it("blocks contact form save when phone has invalid digit count and highlights the field", () => {
    const invalidDraft: Partial<Contact> = {
      firstName: "Ali",
      lastName: "Raza",
      phones: [{ label: "Mobile", number: "344224102", countryCode: "+92", isPrimary: true }],
    };

    const errors = validateContactDraftErrors({
      cleanedDraft: invalidDraft,
      fields: {},
      language: "en",
      isFieldRequired,
      validateBase,
      t: t as unknown as Parameters<typeof validateContactDraftErrors>[0]["t"],
      defaultCountryCode: "+92",
    });

    expect(errors.length).toBe(1);
    expect(errors[0].tabId).toBe("phones");
    expect(errors[0].fieldId).toBe("number");
    expect(errors[0].index).toBe(0);
    expect(errors[0].message).toBe("Pakistan (+92) phone number must be exactly 10 digits");
  });

  it("allows saving contact when phone number has exact valid digits", () => {
    const validDraft: Partial<Contact> = {
      firstName: "Ali",
      lastName: "Raza",
      phones: [{ label: "Mobile", number: "3442241024", countryCode: "+92", isPrimary: true }],
    };

    const errors = validateContactDraftErrors({
      cleanedDraft: validDraft,
      fields: {},
      language: "en",
      isFieldRequired,
      validateBase,
      t: t as unknown as Parameters<typeof validateContactDraftErrors>[0]["t"],
      defaultCountryCode: "+92",
    });

    expect(errors.length).toBe(0);
  });

  it("validates dynamic 2nd phone number (index 1) independently", () => {
    const multiPhoneDraft: Partial<Contact> = {
      firstName: "Ali",
      lastName: "Raza",
      phones: [
        { label: "Mobile", number: "3442241024", countryCode: "+92", isPrimary: true },
        { label: "Work", number: "344224102", countryCode: "+92", isPrimary: false },
      ],
    };

    const errors = validateContactDraftErrors({
      cleanedDraft: multiPhoneDraft,
      fields: {},
      language: "en",
      isFieldRequired,
      validateBase,
      t: t as unknown as Parameters<typeof validateContactDraftErrors>[0]["t"],
      defaultCountryCode: "+92",
    });

    expect(errors.length).toBe(1);
    expect(errors[0].tabId).toBe("phones");
    expect(errors[0].fieldId).toBe("number");
    expect(errors[0].index).toBe(1);
    expect(errors[0].message).toBe("Pakistan (+92) phone number must be exactly 10 digits");
  });

  it("allows empty optional phone entries without error", () => {
    const emptyPhoneDraft: Partial<Contact> = {
      firstName: "Ali",
      lastName: "Raza",
      phones: [{ label: "Mobile", number: "", countryCode: "+92", isPrimary: true }],
    };

    const errors = validateContactDraftErrors({
      cleanedDraft: emptyPhoneDraft,
      fields: {},
      language: "en",
      isFieldRequired,
      validateBase,
      t: t as unknown as Parameters<typeof validateContactDraftErrors>[0]["t"],
      defaultCountryCode: "+92",
    });

    expect(errors.length).toBe(0);
  });
});
