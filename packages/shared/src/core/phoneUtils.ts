/**
 * Phone parsing, E.164 normalization, and primary-phone helpers.
 */

import type { Contact } from "../contacts/contactTypes.js";
import { COUNTRY_CODES } from "../contacts/contactPreferenceConstants.js";

/**
 * Extract country code and local number parts from a raw phone number.
 * @param rawNumber - Raw phone number string
 * @param defaultCode - Fallback country code if none detected
 * @returns Object with countryCode and local number parts.
 */
export function parsePhoneNumber(
  rawNumber: unknown,
  defaultCode = "",
  knownCodes: string[] = [],
): { countryCode: string; number: string } {
  if (!rawNumber) return { countryCode: defaultCode, number: "" };
  let clean = String(rawNumber).trim();
  if (clean.startsWith("00")) {
    clean = "+" + clean.slice(2);
  }

  // Normalize known codes and default codes to form a unique sorted list (longest first)
  const codes = [defaultCode, ...knownCodes, ...COUNTRY_CODES.map((entry) => entry.code)]
    .map((c) => c.trim())
    .filter((c) => c.startsWith("+"));
  const uniqueCodes = Array.from(new Set(codes)).sort((a, b) => b.length - a.length);

  for (const code of uniqueCodes) {
    const escaped = code.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`^(${escaped})(?:\\s+(.*)|(.*))$`);
    const match = clean.match(regex);
    if (match) {
      const rest = (match[2] || match[3] || "").trim();
      return { countryCode: code, number: rest };
    }
  }

  // Fallback to standard 1-4 digit parsing
  const match = clean.match(/^(\+\d{1,4})(?:\s+(.*)|(.*))$/);
  if (match) {
    const code = match[1];
    const rest = (match[2] || match[3] || "").trim();
    return { countryCode: code, number: rest };
  }

  return { countryCode: defaultCode, number: clean };
}

/**
 * Normalizes a phone number to E.164 format.
 * E.g., countryCode "+92", number "300-1234567" -> "+923001234567".
 * If countryCode is missing, it tries to parse it or prepends default code.
 */
export function normalizeToE164(countryCode: string, number: string): string {
  const cleanCode = countryCode.replace(/[^\d]/g, "");
  let cleanNumber = number.replace(/[^\d]/g, "");

  if (cleanCode && cleanNumber.startsWith("0")) {
    cleanNumber = cleanNumber.replace(/^0+/, "");
  }

  if (cleanCode && cleanNumber.startsWith(cleanCode)) {
    return `+${cleanNumber}`;
  }

  return cleanCode ? `+${cleanCode}${cleanNumber}` : cleanNumber;
}

/**
 * Normalizes a scalar phone input to E.164 using the configured default country code.
 */
export function normalizePhoneInput(
  rawNumber: string | null | undefined,
  defaultCountryCode = "",
): string {
  if (!rawNumber?.trim()) return "";
  const parsed = parsePhoneNumber(rawNumber, defaultCountryCode);
  return normalizeToE164(parsed.countryCode, parsed.number);
}

/**
 * Canonical helper to format any phone number string or contact phone entry with a country code (DRY).
 * E.g., "+923001234567" -> "+92 3001234567"
 * E.g., "03001234567" with default "+92" -> "+92 3001234567"
 * E.g., "3001234567" with default "+92" -> "+92 3001234567"
 */
export function formatPhoneWithCountryCode(
  phone: string | null | undefined,
  defaultCountryCode = "",
): string | null {
  if (!phone || !phone.trim()) return null;
  const raw = phone.trim();
  const parsed = parsePhoneNumber(raw, defaultCountryCode);
  const code = (parsed.countryCode || defaultCountryCode).trim();
  let num = (parsed.number || "").trim();

  // Strip a local trunk prefix only when an international code is present.
  if (code && num.startsWith("0")) {
    num = num.replace(/^0+/, "");
  }

  if (!num) return code || null;

  // If number already starts with +, return cleaned
  if (num.startsWith("+")) {
    return num;
  }

  return code ? `${code} ${num}` : num;
}

/**
 * Extract primary phone from contact formatted with country code (DRY).
 * @param contact - Contact object
 * @param defaultCountryCode - Optional fallback country code if configured by the tenant.
 * @returns The formatted primary phone number with country code or null.
 */
export function getPrimaryPhone(
  contact?: Partial<Contact> | null,
  defaultCountryCode = "",
): string | null {
  if (!contact) return null;
  const phones = contact.phones || [];
  const phoneObj =
    phones.find((p) => p.isPrimary && (p.number || "").trim().length > 0) ||
    phones.find((p) => (p.number || "").trim().length > 0) ||
    phones[0];

  if (phoneObj && (phoneObj.number || "").trim().length > 0) {
    const rawNumber = (phoneObj.number || "").trim();
    const code = (phoneObj.countryCode || "").trim() || defaultCountryCode;
    return formatPhoneWithCountryCode(rawNumber, code);
  }

  const scalarPhone = (contact as Record<string, unknown>).phone;
  if (typeof scalarPhone === "string" && scalarPhone.trim().length > 0) {
    return formatPhoneWithCountryCode(scalarPhone.trim(), defaultCountryCode);
  }

  return null;
}

/**
 * Digits-only phone comparison key (last 10 digits when long enough).
 */
const normalizePhoneForComparison = (phoneNumber: unknown): string => {
  if (!phoneNumber) return "";
  const digits = String(phoneNumber).replace(/[^\d]/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

/**
 * Collect normalized phone comparison keys from a contact.
 */
export const getPhoneNumbers = (contact?: Contact | null): string[] => {
  if (!contact) return [];
  const phoneNumbers: string[] = [];
  if (Array.isArray(contact.phones)) {
    contact.phones.forEach((phone) => {
      if (phone?.number) {
        phoneNumbers.push(normalizePhoneForComparison(phone.number));
      }
    });
  }
  if (contact.phone) {
    phoneNumbers.push(normalizePhoneForComparison(contact.phone));
  }
  return Array.from(new Set(phoneNumbers.filter(Boolean)));
};
