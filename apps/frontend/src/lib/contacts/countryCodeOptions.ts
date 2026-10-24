import { normalizeContactDialCode } from "@mms/shared";

/** Merge phone dial-code option edits into tenant `{ country, code }` rows. */
export type CountryCodeEntry = { country: string; code: string };

export { normalizeContactDialCode as normalizeDialCode };

/**
 * Applies an EditableSelect dial-code list onto country/code pairs.
 * Keeps country names when a dial code is removed; adds `{ country: code, code }` for new dials.
 */
export function mergeCountryDialCodeOptions(
  current: CountryCodeEntry[],
  nextCodes: string[],
): CountryCodeEntry[] {
  const unique = Array.from(new Set(nextCodes.map(normalizeContactDialCode).filter(Boolean)));
  const uniqueSet = new Set(unique);

  const next = current.map((entry) => {
    const code = normalizeContactDialCode(entry.code);
    if (code && uniqueSet.has(code)) return { country: entry.country, code };
    return { country: entry.country, code: "" };
  });

  for (const code of unique) {
    if (!next.some((entry) => normalizeContactDialCode(entry.code) === code)) {
      next.push({ country: code, code });
    }
  }

  return next.filter((entry) => entry.country.trim().length > 0 || entry.code.trim().length > 0);
}

/**
 * Applies an EditableSelect country-name list onto country/code pairs.
 * Preserves dial codes for known countries; new names get an empty code.
 */
export function mergeCountryNameOptions(
  current: CountryCodeEntry[],
  nextCountries: string[],
): CountryCodeEntry[] {
  const unique = Array.from(new Set(nextCountries.map((name) => name.trim()).filter(Boolean)));
  const currentByCountry = new Map(current.map((entry) => [entry.country, entry]));
  return unique.map((country) => {
    const existing = currentByCountry.get(country);
    return existing ?? { country, code: "" };
  });
}
