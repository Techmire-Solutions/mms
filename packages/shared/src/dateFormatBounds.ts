/** Formats a local Date object as a `YYYY-MM-DD` storage string. */
export function formatDateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns today's date as a local-calendar `YYYY-MM-DD` storage string. */
export function todayISO(): string {
  return formatDateToIso(new Date());
}

/**
 * Parses a `YYYY-MM-DD` (or ISO datetime) storage string into a local Date at midnight.
 * Returns `undefined` when the string is missing or not a valid calendar day.
 */
export function parseIsoDate(isoStr?: string | null): Date | undefined {
  if (!isoStr || typeof isoStr !== "string") return undefined;
  const dateOnly = isoStr.trim().split(/[T\s]/)[0];
  if (!dateOnly) return undefined;
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (year == null || month == null || day == null || isNaN(year) || isNaN(month) || isNaN(day)) {
    return undefined;
  }
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }
  return date;
}

/**
 * Parses a flexible ISO string (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`) into a local Date object.
 * Returns `undefined` when missing or not a valid date/month/year.
 */
export function parseFlexibleIsoDate(isoStr?: string | null): Date | undefined {
  if (!isoStr || typeof isoStr !== "string") return undefined;
  const dateOnly = isoStr.trim().split(/[T\s]/)[0];
  if (!dateOnly) return undefined;
  const parts = dateOnly.split("-").map(Number);
  if (parts.length === 1) {
    const year = parts[0];
    if (year != null && !isNaN(year) && year >= 1000 && year <= 9999) {
      return new Date(year, 0, 1);
    }
  } else if (parts.length === 2) {
    const [year, month] = parts;
    if (
      year != null &&
      month != null &&
      !isNaN(year) &&
      !isNaN(month) &&
      year >= 1000 &&
      year <= 9999 &&
      month >= 1 &&
      month <= 12
    ) {
      return new Date(year, month - 1, 1);
    }
  } else if (parts.length === 3) {
    return parseIsoDate(isoStr);
  }
  return undefined;
}

/** Returns the year portion of a `YYYY-MM-DD` (or ISO datetime) string, or `undefined` if invalid. */
export function parseIsoYear(isoStr?: string | null): number | undefined {
  if (!isoStr || typeof isoStr !== "string") return undefined;
  const dateOnly = isoStr.trim().split(/[T\s]/)[0];
  if (!dateOnly) return undefined;
  const [year] = dateOnly.split("-").map(Number);
  return year == null || isNaN(year) ? undefined : year;
}

/**
 * Parses a year representation (string "2026", "2026-07-21", number 2026, or Date)
 * into a 4-digit number. Returns `undefined` when missing or invalid.
 */
export function parseYearValue(value?: string | number | Date | null): number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1000 && value <= 9999 ? value : undefined;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    const y = value.getFullYear();
    return Number.isInteger(y) && y >= 1000 && y <= 9999 ? y : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^\d{4}$/.test(trimmed)) {
      const parsed = Number(trimmed);
      return parsed >= 1000 && parsed <= 9999 ? parsed : undefined;
    }
    const isoYear = parseIsoYear(trimmed);
    if (isoYear != null && isoYear >= 1000 && isoYear <= 9999) {
      return isoYear;
    }
  }
  return undefined;
}

/**
 * True when `year` is within optional `minYear` and `maxYear` bounds.
 */
export function isYearWithinBounds(
  year: number,
  minYear?: number | null,
  maxYear?: number | null,
): boolean {
  if (!Number.isFinite(year)) return false;
  if (minYear != null && Number.isFinite(minYear) && year < minYear) return false;
  if (maxYear != null && Number.isFinite(maxYear) && year > maxYear) return false;
  return true;
}

/** Default DayPicker caption year window when `min` / `max` are unset. */
export const DATE_PICKER_YEAR_PAST = 100;
export const DATE_PICKER_YEAR_FUTURE = 10;

/**
 * Resolves normalized minYear and maxYear bounds from mixed inputs (numbers, ISO strings, or explicit year bounds).
 */
export function resolveYearPickerBounds(
  min?: string | number | null,
  max?: string | number | null,
  minYear?: number | null,
  maxYear?: number | null,
): { minYear: number; maxYear: number } {
  const currentYear = new Date().getFullYear();
  const parsedMin = minYear ?? (min != null ? parseYearValue(min) : undefined);
  const parsedMax = maxYear ?? (max != null ? parseYearValue(max) : undefined);

  const resolvedMin = parsedMin ?? currentYear - DATE_PICKER_YEAR_PAST;
  const resolvedMax = parsedMax ?? currentYear + DATE_PICKER_YEAR_FUTURE;

  return {
    minYear: resolvedMin,
    maxYear: resolvedMax,
  };
}

/**
 * True when `date` is on/after optional ISO `min` and on/before optional ISO `max`
 * (normalized local-calendar day comparisons via {@link parseFlexibleIsoDate}).
 */
export function isDateWithinIsoBounds(
  date: Date,
  minIso?: string | null,
  maxIso?: string | null,
): boolean {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const minDate = parseFlexibleIsoDate(minIso);
  if (minDate && target < minDate) return false;
  const maxDate = parseFlexibleIsoDate(maxIso);
  if (maxDate && target > maxDate) return false;
  return true;
}

/**
 * Start/end months for DayPicker `captionLayout="dropdown"` from optional ISO bounds.
 */
export function resolveDatePickerMonthBounds(
  minIso?: string | null,
  maxIso?: string | null,
): { startMonth: Date; endMonth: Date } {
  const nowYear = new Date().getFullYear();
  const minYear = parseYearValue(minIso);
  const maxYear = parseYearValue(maxIso);
  return {
    startMonth: new Date(minYear ?? nowYear - DATE_PICKER_YEAR_PAST, 0),
    endMonth: new Date(maxYear ?? nowYear + DATE_PICKER_YEAR_FUTURE, 11),
  };
}
