/**
 * Country-specific phone number validation, subscriber digit extraction, and input clamping.
 * Single source of truth for both frontend and backend phone validation.
 */

import {
  COUNTRY_PHONE_RULES,
  FALLBACK_PHONE_RULE,
  type CountryPhoneRule,
} from "./phoneCountryRulesData.js";
import type { AppTranslationKey } from "../i18n/appTranslations.js";

export { COUNTRY_PHONE_RULES, FALLBACK_PHONE_RULE, type CountryPhoneRule };

export interface PhoneValidationResult {
  isValid: boolean;
  country: string;
  countryCode: string;
  subscriberDigits: string;
  digitCount: number;
  expectedLengths: number[];
  error?: string;
  messageKey?: string;
}

/** Normalizes a dial code candidate to `+<digits>`. */
export function normalizeCountryDialCode(raw?: string | null): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

/** Looks up country phone rule by dial code (e.g. "+92" or "92") or country name. */
export function getCountryPhoneRule(countryOrCode?: string | null): CountryPhoneRule | undefined {
  if (!countryOrCode) return undefined;
  const trimmed = countryOrCode.trim();
  const normalizedCode = normalizeCountryDialCode(trimmed);

  if (normalizedCode) {
    const matchByCode = COUNTRY_PHONE_RULES.find((r) => r.code === normalizedCode);
    if (matchByCode) return matchByCode;
  }

  const lower = trimmed.toLowerCase();
  return COUNTRY_PHONE_RULES.find(
    (r) => r.country.toLowerCase() === lower || r.code.toLowerCase() === lower,
  );
}

/**
 * Extracts pure subscriber digits from a phone number string.
 * Strips leading `+<countryCode>`, `00<countryCode>`, non-digits, and local trunk zeros.
 */
export function extractSubscriberDigits(
  rawNumber: string | null | undefined,
  countryOrCode?: string | null,
): { subscriberDigits: string; normalizedCountryCode: string; hasLeadingZero: boolean } {
  if (!rawNumber) {
    return { subscriberDigits: "", normalizedCountryCode: "", hasLeadingZero: false };
  }

  let text = String(rawNumber).trim();
  const rule = getCountryPhoneRule(countryOrCode);
  const codeDigits = rule
    ? rule.code.replace(/\D/g, "")
    : normalizeCountryDialCode(countryOrCode).replace(/\D/g, "");

  let hadInternationalPrefix = false;
  if (text.startsWith("00")) {
    text = `+${text.slice(2)}`;
  }

  if (text.startsWith("+")) {
    hadInternationalPrefix = true;
    const digitsOnly = text.replace(/\D/g, "");
    if (codeDigits && digitsOnly.startsWith(codeDigits)) {
      text = digitsOnly.slice(codeDigits.length);
    } else {
      let matchedCode = "";
      for (const r of COUNTRY_PHONE_RULES) {
        const c = r.code.replace(/\D/g, "");
        if (digitsOnly.startsWith(c) && c.length > matchedCode.length) {
          matchedCode = c;
        }
      }
      text = matchedCode ? digitsOnly.slice(matchedCode.length) : digitsOnly;
    }
  }

  let allDigits = text.replace(/\D/g, "");

  if (!hadInternationalPrefix && codeDigits && allDigits.startsWith(codeDigits) && rule) {
    const maxSubLen = Math.max(...rule.lengths);
    if (allDigits.length > maxSubLen) {
      allDigits = allDigits.slice(codeDigits.length);
      hadInternationalPrefix = true;
    }
  }

  let hasLeadingZero = false;
  let subscriberDigits = allDigits;

  if (!hadInternationalPrefix && allDigits.startsWith("0") && (rule?.leadingZeroAllowed ?? true)) {
    hasLeadingZero = true;
    subscriberDigits = allDigits.replace(/^0/, "");
  }

  return {
    subscriberDigits,
    normalizedCountryCode: rule ? rule.code : codeDigits ? `+${codeDigits}` : "",
    hasLeadingZero,
  };
}

/**
 * Validates a phone number against its country's required subscriber digit length(s).
 * An empty or blank phone number is considered valid (optional list entries).
 */
export function validatePhoneNumberByCountry(
  rawNumber: string | null | undefined,
  countryOrCode?: string | null,
  options?: {
    language?: string;
    t?: (key: AppTranslationKey, params?: Record<string, string | number>) => string;
  },
): PhoneValidationResult {
  const rule = getCountryPhoneRule(countryOrCode) ?? FALLBACK_PHONE_RULE;
  const { subscriberDigits } = extractSubscriberDigits(rawNumber, countryOrCode);

  if (!subscriberDigits) {
    return {
      isValid: true,
      country: rule.country,
      countryCode: rule.code,
      subscriberDigits: "",
      digitCount: 0,
      expectedLengths: [...rule.lengths],
    };
  }

  const count = subscriberDigits.length;
  const isExact = rule.lengths.length === 1;
  const isValid = rule.lengths.includes(count);

  if (isValid) {
    return {
      isValid: true,
      country: rule.country,
      countryCode: rule.code,
      subscriberDigits,
      digitCount: count,
      expectedLengths: [...rule.lengths],
    };
  }

  const expectedStr = isExact ? String(rule.lengths[0]) : rule.lengths.join(" or ");
  let error: string;

  if (options?.t) {
    if (isExact) {
      error = options.t("contacts.validation.phoneDigitsExact", {
        country: rule.country,
        code: rule.code,
        expected: expectedStr,
      });
    } else {
      error = options.t("contacts.validation.phoneDigitsRange", {
        country: rule.country,
        code: rule.code,
        min: Math.min(...rule.lengths),
        max: Math.max(...rule.lengths),
      });
    }
  } else if (isExact) {
    error = `${rule.country} (${rule.code}) phone number must be exactly ${expectedStr} digits`;
  } else {
    error = `${rule.country} (${rule.code}) phone number must be ${expectedStr} digits`;
  }

  return {
    isValid: false,
    country: rule.country,
    countryCode: rule.code,
    subscriberDigits,
    digitCount: count,
    expectedLengths: [...rule.lengths],
    error,
    messageKey: isExact
      ? "contacts.validation.phoneDigitsExact"
      : "contacts.validation.phoneDigitsRange",
  };
}

/**
 * Clamps user input so typing/pasting cannot exceed the country's maximum allowed subscriber digits.
 * Preserves an initial trunk zero (up to max + 1) while typing.
 */
export function clampPhoneNumberInput(rawInput: string, countryOrCode?: string | null): string {
  if (!rawInput) return "";
  const rule = getCountryPhoneRule(countryOrCode);
  if (!rule) return rawInput.slice(0, 20);

  const maxSubscriberDigits = Math.max(...rule.lengths);
  const trimmed = rawInput.trim();

  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    const { subscriberDigits, normalizedCountryCode } = extractSubscriberDigits(
      trimmed,
      countryOrCode,
    );
    const clampedDigits = subscriberDigits.slice(0, maxSubscriberDigits);
    return normalizedCountryCode ? `${normalizedCountryCode} ${clampedDigits}` : clampedDigits;
  }

  const startsWithZero = rawInput.startsWith("0");
  const maxDigitsAllowed = startsWithZero ? maxSubscriberDigits + 1 : maxSubscriberDigits;

  let digitCount = 0;
  let clamped = "";

  for (let i = 0; i < rawInput.length; i++) {
    const char = rawInput[i];
    if (/\d/.test(char)) {
      if (digitCount < maxDigitsAllowed) {
        clamped += char;
        digitCount++;
      }
    } else if (digitCount > 0 && digitCount < maxDigitsAllowed) {
      clamped += char;
    }
  }

  return clamped;
}

/**
 * Returns the maximum input character length for an input field.
 */
export function getMaxAllowedPhoneInputLength(
  currentValue: string,
  countryOrCode?: string | null,
): number {
  const rule = getCountryPhoneRule(countryOrCode);
  if (!rule) return 20;
  const maxDigits = Math.max(...rule.lengths);
  const hasZero = currentValue.startsWith("0");
  return maxDigits + (hasZero ? 1 : 0) + 4;
}
