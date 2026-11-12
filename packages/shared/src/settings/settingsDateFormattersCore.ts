import { getIntlLocaleForLanguage } from "../core/languageUtils.js";
import { getStoredGlobalSettings } from "./settingsDateProvider.js";
import { GREGORIAN_CALENDAR } from "./settingsDateDigits.js";
import { formatDate } from "./settingsDateFormat.js";
export { formatDate };

/** Formats a date and time. */
export function formatDateTime(
  date: string | Date | number | null | undefined,
  showMonthName = true,
): string {
  if (!date) return "—";
  const parsedDate = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(parsedDate.getTime())) return "—";

  const datePart = formatDate(date, showMonthName);
  const stored = getStoredGlobalSettings();
  const timezone = stored.timezone;
  const language = stored.language;

  const intlLocale = getIntlLocaleForLanguage(language);
  const timeFormatter = new Intl.DateTimeFormat(intlLocale, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });

  return `${datePart} ${timeFormatter.format(parsedDate)}`;
}

/**
 * Formats a Date object or date string as a month and year (e.g. "Jan 2026").
 */
export function formatMonthYear(
  date: string | Date | number | null | undefined,
  monthStyle: "numeric" | "2-digit" | "long" | "short" | "narrow" = "short",
): string {
  if (!date) return "—";
  const parsedDate = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(parsedDate.getTime())) return "—";

  const stored = getStoredGlobalSettings();
  const timezone = stored.timezone;
  const language = stored.language;

  const intlLocale = getIntlLocaleForLanguage(language);
  return new Intl.DateTimeFormat(intlLocale, {
    calendar: GREGORIAN_CALENDAR,
    timeZone: timezone,
    month: monthStyle,
    year: "numeric",
  }).format(parsedDate);
}

/**
 * Formats a Date object or date string as a short month name (e.g. "Jan").
 */
export function formatMonthName(date: string | Date | number | null | undefined): string {
  if (!date) return "—";
  const parsedDate = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(parsedDate.getTime())) return "—";

  const stored = getStoredGlobalSettings();
  const timezone = stored.timezone;
  const language = stored.language;

  const intlLocale = getIntlLocaleForLanguage(language);
  return new Intl.DateTimeFormat(intlLocale, {
    calendar: GREGORIAN_CALENDAR,
    timeZone: timezone,
    month: "short",
  }).format(parsedDate);
}

/**
 * Formats a Date object or date string as a weekday (e.g. "Monday").
 */
export function formatDayName(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const parsedDate = typeof date === "string" ? new Date(date) : date;
  if (isNaN(parsedDate.getTime())) return "—";

  const stored = getStoredGlobalSettings();
  const timezone = stored.timezone;
  const language = stored.language;

  const intlLocale = getIntlLocaleForLanguage(language);
  return new Intl.DateTimeFormat(intlLocale, {
    calendar: GREGORIAN_CALENDAR,
    timeZone: timezone,
    weekday: "long",
  }).format(parsedDate);
}

/**
 * Localized short weekday labels Monday→Sunday for chart axes (Mon, Tue, …).
 */
export function formatShortWeekdayLabels(): string[] {
  const stored = getStoredGlobalSettings();
  const intlLocale = getIntlLocaleForLanguage(stored.language);
  // 2024-01-01 was a Monday (UTC).
  const formatter = new Intl.DateTimeFormat(intlLocale, {
    calendar: GREGORIAN_CALENDAR,
    weekday: "short",
    timeZone: "UTC",
  });
  return Array.from({ length: 7 }, (_, dayIndex) => {
    const date = new Date(Date.UTC(2024, 0, 1 + dayIndex));
    return formatter.format(date);
  });
}

/**
 * Formats a Date object or date string as a long date (e.g. "January 2, 2000").
 */
export function formatLongDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const parsedDate = typeof date === "string" ? new Date(date) : date;
  if (isNaN(parsedDate.getTime())) return "—";

  const stored = getStoredGlobalSettings();
  const timezone = stored.timezone;
  const language = stored.language;

  const intlLocale = getIntlLocaleForLanguage(language);
  return new Intl.DateTimeFormat(intlLocale, {
    calendar: GREGORIAN_CALENDAR,
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsedDate);
}

/** Checks whether the runtime supports a calendar system. */
export function isCalendarSupported(calendarId: string): boolean {
  try {
    if (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("calendar").includes(calendarId);
    }
    new Intl.DateTimeFormat(`en-u-ca-${calendarId}`);
    return true;
  } catch {
    return false;
  }
}

/** Formats a Hijri date; prefers Umm al-Qura when available. */
export function formatHijriDate(
  date: string | Date | null | undefined,
  options?: { calendar?: "islamic" | "islamic-umalqura" },
): string {
  if (!date) return "—";
  const parsedDate = typeof date === "string" ? new Date(date) : date;
  if (isNaN(parsedDate.getTime())) return "";

  const stored = getStoredGlobalSettings();
  const timezone = stored.timezone;
  const language = stored.language;

  const intlLocale = getIntlLocaleForLanguage(language);
  const calendarType = options?.calendar ?? "islamic-umalqura";
  const effectiveCalendar = isCalendarSupported(calendarType) ? calendarType : "islamic";
  try {
    return new Intl.DateTimeFormat(`${intlLocale}-u-ca-${effectiveCalendar}`, {
      timeZone: timezone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(parsedDate);
  } catch {
    try {
      return new Intl.DateTimeFormat(`${intlLocale}-u-ca-islamic`, {
        timeZone: timezone,
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(parsedDate);
    } catch {
      return "";
    }
  }
}

/**
 * Formats a Date object or date string as a Solar Hijri (Persian / Shamsi) date.
 */
export function formatSolarHijriDate(
  date: string | Date | null | undefined,
  localeOverride?: string,
): string {
  if (!date) return "—";
  const parsedDate = typeof date === "string" ? new Date(date) : date;
  if (isNaN(parsedDate.getTime())) return "";

  const stored = getStoredGlobalSettings();
  const timezone = stored.timezone;
  const language = localeOverride ?? (stored.language === "fa" ? "fa" : "fa-IR");

  try {
    return new Intl.DateTimeFormat(`${language}-u-ca-persian`, {
      timeZone: timezone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(parsedDate);
  } catch {
    return "";
  }
}

/**
 * Generates a list of recent months ending with the current month.
 */
export function getRecentMonthsList(count: number): { key: string; label: string }[] {
  const list: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const monthNum = String(monthIndex + 1).padStart(2, "0");
    const key = `${year}-${monthNum}`;
    const label = formatMonthName(d);
    list.push({ key, label });
  }
  return list;
}
