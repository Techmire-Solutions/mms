import { isCalendarSupported } from "../settings/settingsDateFormattersCore.js";

const UMALQURA = "islamic-umalqura";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Umm al-Qura where the runtime has it, plain `islamic` otherwise. */
function hijriCalendarId(): string {
  return isCalendarSupported(UMALQURA) ? UMALQURA : "islamic";
}

function utcDate(isoDate: string): Date | null {
  if (!ISO_DATE.test(isoDate)) return null;
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Hijri day of the month for a Gregorian ISO date (`YYYY-MM-DD`).
 *
 * Fixed to UTC so a calendar cell shows the same Hijri day for every viewer, regardless of the
 * timezone their browser is in.
 *
 * @param isoDate - Gregorian date as `YYYY-MM-DD`
 * @returns The Hijri day of the month, or null when the date is unusable
 */
export function hijriDayOfMonth(isoDate: string): number | null {
  const date = utcDate(isoDate);
  if (!date) return null;
  try {
    const parts = new Intl.DateTimeFormat(`en-US-u-ca-${hijriCalendarId()}`, {
      timeZone: "UTC",
      day: "numeric",
    }).formatToParts(date);
    const day = parts.find((part) => part.type === "day")?.value;
    const parsed = day ? Number.parseInt(day, 10) : Number.NaN;
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Hijri month and year label for a Gregorian ISO date, e.g. `"Rajab 1447 AH"`.
 *
 * @param isoDate - Gregorian date as `YYYY-MM-DD`
 * @param locale - BCP 47 locale for the month name (defaults to `en`)
 * @returns The localized label, or an empty string when the date is unusable
 */
export function hijriMonthYearLabel(isoDate: string, locale = "en"): string {
  const date = utcDate(isoDate);
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat(`${locale}-u-ca-${hijriCalendarId()}`, {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}

/**
 * Hijri label covering the months a Gregorian month spans.
 *
 * A Gregorian month almost always straddles two Hijri months, so the month grid needs both ends.
 * Collapses to a single label when both dates fall in the same Hijri month.
 *
 * @param firstIsoDate - First day of the Gregorian month as `YYYY-MM-DD`
 * @param lastIsoDate - Last day of the Gregorian month as `YYYY-MM-DD`
 * @param locale - BCP 47 locale for the month names (defaults to `en`)
 * @returns The localized label, or an empty string when either date is unusable
 */
export function hijriMonthSpanLabel(
  firstIsoDate: string,
  lastIsoDate: string,
  locale = "en",
): string {
  const start = hijriMonthYearLabel(firstIsoDate, locale);
  const end = hijriMonthYearLabel(lastIsoDate, locale);
  if (!start || !end) return "";
  return start === end ? start : `${start} – ${end}`;
}
