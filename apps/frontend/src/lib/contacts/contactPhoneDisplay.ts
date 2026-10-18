import {
  formatPhoneWithCountryCode,
  parsePhoneNumber,
  getPrimaryPhone,
  sanitizePhoneForTel,
  type Contact,
  type ContactPreferences,
} from "@mms/shared";

/** Standardized phone display formatter for contacts tables and cards. */
export function formatContactPhoneDisplay(
  rawNumber: string | undefined | null,
  countryCodeFallback = "",
): { countryCode: string; formattedNumber: string } {
  if (!rawNumber) return { countryCode: countryCodeFallback, formattedNumber: "" };
  const fullPhone = formatPhoneWithCountryCode(rawNumber, countryCodeFallback);
  if (!fullPhone) return { countryCode: countryCodeFallback, formattedNumber: "" };
  const parsed = parsePhoneNumber(fullPhone, countryCodeFallback);
  return {
    countryCode: parsed.countryCode || countryCodeFallback,
    formattedNumber: parsed.number || rawNumber,
  };
}

/** Formats a full number with country code (kept whole for WhatsApp/messaging). */
export function formatContactPhoneFull(
  rawNumber: string | undefined | null,
  countryCodeFallback = "",
): string {
  return formatPhoneWithCountryCode(rawNumber, countryCodeFallback) || String(rawNumber || "");
}

/** Formats tel: link href for telephone actions. */
export function formatTelHref(phoneStr: string | undefined | null): string {
  return sanitizePhoneForTel(phoneStr) || "#";
}

/** Resolves fallback country code from prefs → mapped code → first configured code (no hardcoded dial). */
export function getFallbackCountryCode(
  prefs?: Partial<ContactPreferences>,
  countryCodesMap?: Record<string, string>,
  countryCodes?: Array<{ country: string; code: string }>,
): string {
  const defaultCountry = prefs?.defaultCountry;
  if (defaultCountry && countryCodesMap?.[defaultCountry]) {
    return countryCodesMap[defaultCountry];
  }
  const firstConfigured = countryCodes?.find((entry) => entry.code)?.code;
  if (firstConfigured) return firstConfigured;
  const firstMapped = countryCodesMap && Object.values(countryCodesMap).find(Boolean);
  return firstMapped || "";
}

/** Resolves primary phone, country code, and formatted display for a contact. */
export function resolveContactPhoneDisplay(
  contact: Contact,
  prefs?: Partial<ContactPreferences>,
  countryCodesMap?: Record<string, string>,
  countryCodes?: Array<{ country: string; code: string }>,
): { phone: string | null; countryCode: string; phoneDisplay: string } {
  const defaultCountryCode = getFallbackCountryCode(prefs, countryCodesMap, countryCodes);
  const primaryPhone = getPrimaryPhone(contact, defaultCountryCode);
  const firstPhoneObj =
    (contact.phones || []).find((p) => (p.number || "").trim().length > 0) || contact.phones?.[0];
  const { countryCode, formattedNumber: phoneDisplay } = formatContactPhoneDisplay(
    primaryPhone || firstPhoneObj?.number,
    firstPhoneObj?.countryCode || defaultCountryCode,
  );
  return {
    phone: primaryPhone,
    countryCode,
    phoneDisplay,
  };
}

export interface ContactResolvedPhone {
  phone: string;
  countryCode: string;
  phoneDisplay: string;
  label?: string;
  isPrimary?: boolean;
}

export interface ContactResolvedEmail {
  email: string;
  label?: string;
  isPrimary?: boolean;
}

/** Resolves all phone numbers from a contact, preserving labels and country codes. */
export function resolveAllContactPhones(
  contact: Partial<Contact> | undefined | null,
  prefs?: Partial<ContactPreferences>,
  countryCodesMap?: Record<string, string>,
  countryCodes?: Array<{ country: string; code: string }>,
): ContactResolvedPhone[] {
  if (!contact) return [];
  const defaultCountryCode = getFallbackCountryCode(prefs, countryCodesMap, countryCodes);
  const result: ContactResolvedPhone[] = [];
  const seen = new Set<string>();

  if (Array.isArray(contact.phones) && contact.phones.length > 0) {
    for (const p of contact.phones) {
      const num = (p.number || "").trim();
      if (!num || seen.has(num)) continue;
      seen.add(num);
      const effectiveCc = p.countryCode || defaultCountryCode;
      const { countryCode, formattedNumber: phoneDisplay } = formatContactPhoneDisplay(
        num,
        effectiveCc,
      );
      result.push({
        phone: num,
        countryCode,
        phoneDisplay,
        label: p.label,
        isPrimary: p.isPrimary,
      });
    }
  }

  if (result.length === 0) {
    const scalarPhone = typeof contact.phone === "string" ? contact.phone.trim() : "";
    if (scalarPhone && !seen.has(scalarPhone)) {
      const { countryCode, formattedNumber: phoneDisplay } = formatContactPhoneDisplay(
        scalarPhone,
        defaultCountryCode,
      );
      result.push({
        phone: scalarPhone,
        countryCode,
        phoneDisplay,
        isPrimary: true,
      });
    }
  }

  return result;
}

/** Resolves all email addresses from a contact, preserving labels. */
export function resolveAllContactEmails(
  contact: Partial<Contact> | undefined | null,
): ContactResolvedEmail[] {
  if (!contact) return [];
  const result: ContactResolvedEmail[] = [];
  const seen = new Set<string>();

  if (Array.isArray(contact.emails) && contact.emails.length > 0) {
    for (const e of contact.emails) {
      const legacyEmail = "email" in e && typeof e.email === "string" ? e.email : "";
      const addr = (e.address || legacyEmail || "").toString().trim();
      if (!addr || seen.has(addr.toLowerCase())) continue;
      seen.add(addr.toLowerCase());
      result.push({
        email: addr,
        label: e.label,
        isPrimary: e.isPrimary,
      });
    }
  }

  if (result.length === 0) {
    const scalarEmail = typeof contact.email === "string" ? contact.email.trim() : "";
    if (scalarEmail && !seen.has(scalarEmail.toLowerCase())) {
      result.push({
        email: scalarEmail,
        isPrimary: true,
      });
    }
  }

  return result;
}
