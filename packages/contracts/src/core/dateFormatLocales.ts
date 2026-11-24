import { getIntlLocaleForLanguage } from "./languageUtils.js";
import {
  type DateFormatId,
  type DateFormatOption,
  LOCALE_PROBE_DATE,
  PRESETS,
} from "./dateFormatPresets.js";
import { formatDateParts } from "./dateFormatParse.js";
import { formatIntlInteger, normalizeIntlDigits } from "./intlDigits.js";

const INTL_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getCachedIntlFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let formatter = INTL_FORMATTER_CACHE.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    INTL_FORMATTER_CACHE.set(key, formatter);
  }
  return formatter;
}

/**
 * Infers the closest preset for a UI language using `Intl` regional conventions.
 */
export function detectLocaleDateFormat(language: string): DateFormatId {
  const locale = getIntlLocaleForLanguage(language);
  const parts = getCachedIntlFormatter(locale, {
    calendar: "gregory",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(LOCALE_PROBE_DATE);

  const order = parts
    .filter((p) => p.type === "day" || p.type === "month" || p.type === "year")
    .map((p) => p.type);
  const separator = parts.find((p) => p.type === "literal" && /[/\-.]/.test(p.value))?.value ?? "/";

  if (order[0] === "year") {
    return separator === "-" ? "YYYY-MM-DD" : "YYYY/MM/DD";
  }
  if (order[0] === "month") {
    return "MM/DD/YYYY";
  }
  if (separator === ".") return "DD.MM.YYYY";
  if (separator === "-") return "DD-MM-YYYY";
  return "DD/MM/YYYY";
}

/**
 * Builds select options with a live sample for each preset.
 */
export function getDateFormatOptions(
  language: string,
  sample: Date = new Date(),
): readonly DateFormatOption[] {
  const locale = getIntlLocaleForLanguage(language);
  const intlParts = getCachedIntlFormatter(locale, {
    calendar: "gregory",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(sample);
  const parsePart = (type: "day" | "month" | "year", fallback: number): number => {
    const raw = intlParts.find((part) => part.type === type)?.value;
    if (!raw) return fallback;
    const parsed = Number(normalizeIntlDigits(raw));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const day = parsePart("day", sample.getUTCDate());
  const month = parsePart("month", sample.getUTCMonth() + 1);
  const year = parsePart("year", sample.getUTCFullYear());
  const formatNumberPart = (value: number, minimumIntegerDigits: number): string =>
    formatIntlInteger(value, minimumIntegerDigits, locale);

  return PRESETS.map((preset) => ({
    value: preset.id,
    pattern: preset.id,
    sample: formatDateParts(day, month, year, preset.id, formatNumberPart),
    hintKey: preset.hintKey,
  }));
}

const RELATIVE_TIME_FORMATTER_CACHE = new Map<string, Intl.RelativeTimeFormat>();

function getCachedRelativeTimeFormatter(
  locale: string,
  options?: Intl.RelativeTimeFormatOptions,
): Intl.RelativeTimeFormat {
  const key = `${locale}:${JSON.stringify(options ?? {})}`;
  let formatter = RELATIVE_TIME_FORMATTER_CACHE.get(key);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, {
      numeric: "auto",
      ...options,
    });
    RELATIVE_TIME_FORMATTER_CACHE.set(key, formatter);
  }
  return formatter;
}

/**
 * Modern Web Guidance: format-human-readable-durations
 * Formats a relative time description (e.g., "5 minutes ago", "in 2 hours", "yesterday")
 * natively using `Intl.RelativeTimeFormat` across all supported locales (en, ar, ur, fa).
 */
export function formatRelativeTime(
  targetDate: Date | string | number,
  languageOrLocale: string = "en",
  baseDate: Date = new Date(),
): string {
  const date = targetDate instanceof Date ? targetDate : new Date(targetDate);
  if (Number.isNaN(date.getTime())) return "";

  const locale = getIntlLocaleForLanguage(languageOrLocale);
  const diffSeconds = Math.round((date.getTime() - baseDate.getTime()) / 1000);

  const formatter = getCachedRelativeTimeFormatter(locale);

  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 60) {
    return formatter.format(diffSeconds, "second");
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  const absMinutes = Math.abs(diffMinutes);
  if (absMinutes < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  const absDays = Math.abs(diffDays);
  if (absDays < 30) {
    return formatter.format(diffDays, "day");
  }

  const diffMonths = Math.round(diffDays / 30);
  const absMonths = Math.abs(diffMonths);
  if (absMonths < 12) {
    return formatter.format(diffMonths, "month");
  }

  const diffYears = Math.round(diffDays / 365);
  return formatter.format(diffYears, "year");
}

/** Structured duration values matching modern Temporal and Intl.DurationFormat specifications */
export interface FormatDurationInput {
  years?: number;
  months?: number;
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}

export interface FormatDurationOptions {
  style?: "long" | "short" | "narrow" | "digital";
  languageOrLocale?: string;
}

// Map for memoizing DurationFormat instances per locale and style
const durationFormatterCache = new Map<string, unknown>();

function getCachedDurationFormatter(
  locale: string,
  style: "long" | "short" | "narrow" | "digital",
): { format: (d: FormatDurationInput) => string } | null {
  const cacheKey = `${locale}:${style}`;
  let formatter = durationFormatterCache.get(cacheKey) as
    { format: (d: FormatDurationInput) => string } | undefined;
  if (!formatter) {
    if (typeof Intl !== "undefined" && "DurationFormat" in Intl) {
      try {
        const Ctor = (
          Intl as unknown as {
            DurationFormat: new (
              loc: string,
              opt: { style: string },
            ) => { format: (d: FormatDurationInput) => string };
          }
        ).DurationFormat;
        formatter = new Ctor(locale, { style });
        durationFormatterCache.set(cacheKey, formatter);
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }
  return formatter;
}

/**
 * Modern Web Guidance: format-human-readable-durations
 * Formats structured duration values ({ hours, minutes, seconds, ... }) natively
 * using `Intl.DurationFormat` across supported locales (en, ar, ur, fa).
 * Falls back cleanly to readable string construction if unsupported.
 */
export function formatDuration(
  duration: FormatDurationInput,
  options?: FormatDurationOptions,
): string {
  const languageOrLocale = options?.languageOrLocale ?? "en";
  const locale = getIntlLocaleForLanguage(languageOrLocale);
  const style = options?.style ?? "long";

  const formatter = getCachedDurationFormatter(locale, style);
  if (formatter) {
    try {
      return formatter.format(duration);
    } catch {
      // Fall through to manual fallback
    }
  }

  // Fallback: simple English string assembly
  const parts: string[] = [];
  if (duration.years) parts.push(`${duration.years} ${duration.years === 1 ? "year" : "years"}`);
  if (duration.months)
    parts.push(`${duration.months} ${duration.months === 1 ? "month" : "months"}`);
  if (duration.weeks) parts.push(`${duration.weeks} ${duration.weeks === 1 ? "week" : "weeks"}`);
  if (duration.days) parts.push(`${duration.days} ${duration.days === 1 ? "day" : "days"}`);
  if (duration.hours) parts.push(`${duration.hours} ${duration.hours === 1 ? "hour" : "hours"}`);
  if (duration.minutes)
    parts.push(`${duration.minutes} ${duration.minutes === 1 ? "minute" : "minutes"}`);
  if (duration.seconds)
    parts.push(`${duration.seconds} ${duration.seconds === 1 ? "second" : "seconds"}`);

  return parts.length > 0 ? parts.join(", ") : "0 seconds";
}
