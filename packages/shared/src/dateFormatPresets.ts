import type { AppTranslationKey } from "./appTranslations.js";

/** Supported global date display format identifiers. */
export const DATE_FORMAT_PRESET_IDS = [
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
  "DD-MM-YYYY",
  "DD.MM.YYYY",
  "YYYY/MM/DD",
] as const;

export type DateFormatId = (typeof DATE_FORMAT_PRESET_IDS)[number];

export interface DateFormatPreset {
  id: DateFormatId;
  hintKey: AppTranslationKey;
}

export interface DateFormatOption {
  value: DateFormatId;
  pattern: DateFormatId;
  sample: string;
  hintKey: AppTranslationKey;
}

export const PRESETS: readonly DateFormatPreset[] = [
  { id: "DD/MM/YYYY", hintKey: "global.dateFormatDayFirst" },
  { id: "MM/DD/YYYY", hintKey: "global.dateFormatMonthFirst" },
  { id: "YYYY-MM-DD", hintKey: "global.dateFormatIso" },
  { id: "DD-MM-YYYY", hintKey: "global.dateFormatDayFirst" },
  { id: "DD.MM.YYYY", hintKey: "global.dateFormatDayFirst" },
  { id: "YYYY/MM/DD", hintKey: "global.dateFormatYearFirst" },
] as const;

export const PRESET_SET = new Set<string>(DATE_FORMAT_PRESET_IDS);

/** Reference date for locale detection: 2 Jan 2000 (unambiguous ordering). */
export const LOCALE_PROBE_DATE = new Date(Date.UTC(2000, 0, 2));

/**
 * Coerces a stored value to a supported date format id.
 */
export function normalizeDateFormat(
  value: string | null | undefined,
  fallback: DateFormatId = "DD/MM/YYYY",
): DateFormatId {
  const trimmed = value?.trim();
  if (trimmed && PRESET_SET.has(trimmed)) return trimmed as DateFormatId;
  return fallback;
}

/**
 * Normalizes 2-digit years using a sliding pivot:
 * > 50 -> 1900s, <= 50 -> 2000s.
 */
export function normalizeTwoDigitYear(year: number): number {
  if (year >= 100) return year;
  return year > 50 ? 1900 + year : 2000 + year;
}

/** All preset definitions (for documentation / settings registries). */
export function getDateFormatPresets(): readonly DateFormatPreset[] {
  return PRESETS;
}
