/** Validate Contacts Setup → Preferences drafts before persist. */
import { toTitleCase } from "./titleCaseStringUtils.js";
import type { ContactPreferences } from "./contactFieldSchemaTypes.js";
import { normalizeContactPreferences } from "./contactPreferenceDefaults.js";

export type ContactPreferencesCountryCode = { country: string; code: string };

/** Setup Preferences validation failure codes (map to `contacts.setup.*` i18n). */
export type ContactPreferencesSetupIssue =
  | "invalidProvince"
  | "invalidCity"
  | "invalidThresholdHigh"
  | "invalidThresholdMedium"
  | "thresholdOrder"
  | "emptyCountryRow"
  | "invalidDialCode"
  | "duplicateCountry";

/** Normalize a dial-code string to `+…` form (empty → ""). */
export function normalizeContactDialCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/^\+*/, "").replace(/\s+/g, "");
  return digits ? `+${digits}` : "";
}

function isValidDialCode(code: string): boolean {
  return /^\+[1-9]\d{0,14}$/.test(code);
}

function isValidThreshold(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 100;
}

/**
 * Validates and normalizes Preferences + country-code drafts for Setup Save.
 * Returns normalized payloads on success, or a single issue code for i18n toasts.
 */
export function prepareContactPreferencesSetupSave(
  prefs: ContactPreferences,
  countryCodes: ContactPreferencesCountryCode[],
):
  | {
      ok: true;
      prefs: ContactPreferences;
      countryCodes: ContactPreferencesCountryCode[];
    }
  | { ok: false; issue: ContactPreferencesSetupIssue } {
  if (prefs.defaultProvince && /\d/.test(prefs.defaultProvince)) {
    return { ok: false, issue: "invalidProvince" };
  }
  if (prefs.defaultCity && /\d/.test(prefs.defaultCity)) {
    return { ok: false, issue: "invalidCity" };
  }

  const high = prefs.duplicateDetectionThresholdHigh;
  const medium = prefs.duplicateDetectionThresholdMedium;
  if (!isValidThreshold(high)) return { ok: false, issue: "invalidThresholdHigh" };
  if (!isValidThreshold(medium)) return { ok: false, issue: "invalidThresholdMedium" };
  if (high <= medium) return { ok: false, issue: "thresholdOrder" };

  const normalizedCodes: ContactPreferencesCountryCode[] = [];
  const seenCountries = new Set<string>();

  for (const entry of countryCodes) {
    const country = entry.country.trim();
    const code = normalizeContactDialCode(entry.code);
    if (!country || !code) {
      return { ok: false, issue: "emptyCountryRow" };
    }
    if (!isValidDialCode(code)) {
      return { ok: false, issue: "invalidDialCode" };
    }
    const countryKey = country.toLowerCase();
    if (seenCountries.has(countryKey)) {
      return { ok: false, issue: "duplicateCountry" };
    }
    seenCountries.add(countryKey);
    normalizedCodes.push({ country: toTitleCase(country), code });
  }

  const namePrefixes = (prefs.namePrefixesToIgnore ?? [])
    .map((prefix) => prefix.trim().toLowerCase())
    .filter(Boolean);

  const updatedPrefs = normalizeContactPreferences({
    ...prefs,
    defaultCountry: prefs.defaultCountry ? toTitleCase(prefs.defaultCountry.trim()) : "",
    defaultProvince: prefs.defaultProvince ? toTitleCase(prefs.defaultProvince.trim()) : "",
    defaultCity: prefs.defaultCity ? toTitleCase(prefs.defaultCity.trim()) : "",
    duplicateDetectionThresholdHigh: Math.round(high),
    duplicateDetectionThresholdMedium: Math.round(medium),
    namePrefixesToIgnore: namePrefixes,
  });

  return { ok: true, prefs: updatedPrefs, countryCodes: normalizedCodes };
}
