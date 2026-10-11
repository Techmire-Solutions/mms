/**
 * Calculate age based on a date of birth string.
 * @param dob - Date of birth string
 * @returns Age in years, or null if invalid/missing
 */
export function calcAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

/**
 * Safely parses a Date-of-Birth string into a UTC Date object and its numeric year, month, and day components.
 * @param dob - Date of birth string
 * @returns Object with parsed year, 0-indexed month, day, and UTC Date instance, or null if invalid
 */
export function parseUtcDateParts(
  dob: string | null | undefined,
): { year: number; month: number; day: number; date: Date } | null {
  if (!dob) return null;
  const dateOnly = dob.split("T")[0];
  const parts = dateOnly.split("-");
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const date = new Date(Date.UTC(year, month, day));
  if (isNaN(date.getTime())) return null;
  return { year, month, day, date };
}

export interface SolarAgeParts {
  years: number;
  months: number;
  days: number;
}

/**
 * Calculates numeric solar age components (Years, Months, Days) for a given date of birth.
 * SRP: Pure date arithmetic responsibility.
 */
export function getSolarAgeComponents(dob: string, relativeTo = new Date()): SolarAgeParts | null {
  try {
    const parsed = parseUtcDateParts(dob);
    if (!parsed || parsed.date > relativeTo) return null;

    let years = relativeTo.getFullYear() - parsed.year;
    let months = relativeTo.getMonth() - parsed.month;
    let days = relativeTo.getDate() - parsed.day;

    if (days < 0) {
      months--;
      const prevMonth = new Date(relativeTo.getFullYear(), relativeTo.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years < 0) return null;

    return { years, months, days };
  } catch {
    return null;
  }
}

/**
 * Formats numeric solar age components into a localized string representation.
 * SRP: Pure formatting and localization responsibility.
 */
export function formatSolarAgeComponents(parts: SolarAgeParts | null, locale = "en"): string {
  if (!parts) return "";
  const { years, months, days } = parts;
  if (locale.startsWith("ar") || locale.startsWith("ur") || locale.startsWith("fa")) {
    const nf = new Intl.NumberFormat(`${locale}-u-nu-arabext`);
    return `${nf.format(years)}y ${nf.format(months)}m ${nf.format(days)}d`;
  }
  return `${years}y ${months}m ${days}d`;
}

/**
 * Calculate detailed solar age (Years, Months, Days) based on a date of birth.
 * Composite helper for callers.
 */
export function calculateDetailedSolarAge(dob: string, locale = "en"): string {
  const parts = getSolarAgeComponents(dob);
  return formatSolarAgeComponents(parts, locale);
}

/**
 * Convert Gregorian date of birth to a Hijri (lunar) date string.
 * @param dob - Gregorian date of birth string
 * @param locale - Active language locale
 * @returns Localized Hijri date string
 */
export function getLunarDateString(dob: string, locale = "en"): string {
  try {
    const parsed = parseUtcDateParts(dob);
    if (!parsed) return "";
    const formatter = new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return formatter.format(parsed.date);
  } catch {
    return "";
  }
}

function getHijriParts(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
    timeZone: "UTC",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const day = parseInt(parts.find((p) => p.type === "day")?.value || "1", 10);
  const month = parseInt(parts.find((p) => p.type === "month")?.value || "1", 10);
  const year = parseInt(parts.find((p) => p.type === "year")?.value || "1", 10);
  return { year, month, day };
}

export interface LunarAgeParts {
  years: number;
  months: number;
  days: number;
}

/**
 * Calculates numeric Hijri (lunar) age components (Years, Months, Days) for a given date of birth.
 * SRP: Pure Hijri date arithmetic responsibility.
 */
export function getLunarAgeComponents(dob: string, relativeTo = new Date()): LunarAgeParts | null {
  try {
    const parsed = parseUtcDateParts(dob);
    if (!parsed || parsed.date > relativeTo) return null;

    const birthParts = getHijriParts(parsed.date);
    const nowParts = getHijriParts(relativeTo);

    let years = nowParts.year - birthParts.year;
    let months = nowParts.month - birthParts.month;
    let days = nowParts.day - birthParts.day;

    if (days < 0) {
      months--;
      days += 30;
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years < 0) return null;

    return { years, months, days };
  } catch {
    return null;
  }
}

/**
 * Calculate detailed Hijri (lunar) age (Years, Months, Days) based on a date of birth.
 * Composite helper reusing formatSolarAgeComponents.
 */
export function calculateDetailedLunarAge(dob: string, locale = "en"): string {
  const parts = getLunarAgeComponents(dob);
  return formatSolarAgeComponents(parts, locale);
}
