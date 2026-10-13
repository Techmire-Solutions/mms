/** ISO calendar date helpers and DayPicker month bounds. */

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
 * Parses a `YYYY-MM-DD` storage string into a local Date at midnight.
 * Returns `undefined` when the string is missing or not a valid calendar day.
 */
export function parseIsoDate(isoStr?: string): Date | undefined {
  if (!isoStr) return undefined;
  const [year, month, day] = isoStr.split("-").map(Number);
  if (year == null || month == null || day == null || isNaN(year) || isNaN(month) || isNaN(day)) {
    return undefined;
  }
  return new Date(year, month - 1, day);
}

/** Returns the year portion of a `YYYY-MM-DD` string, or `undefined` if invalid. */
export function parseIsoYear(isoStr?: string): number | undefined {
  if (!isoStr) return undefined;
  const [year] = isoStr.split("-").map(Number);
  return year == null || isNaN(year) ? undefined : year;
}

/** Default DayPicker caption year window when `min` / `max` are unset. */
export const DATE_PICKER_YEAR_PAST = 100;
export const DATE_PICKER_YEAR_FUTURE = 10;

/**
 * True when `date` is on/after optional ISO `min` and on/before optional ISO `max`
 * (local-calendar midnight comparisons via {@link parseIsoDate}).
 */
export function isDateWithinIsoBounds(date: Date, minIso?: string, maxIso?: string): boolean {
  const minDate = parseIsoDate(minIso);
  if (minDate && date < minDate) return false;
  const maxDate = parseIsoDate(maxIso);
  if (maxDate && date > maxDate) return false;
  return true;
}

/**
 * Start/end months for DayPicker `captionLayout="dropdown"` from optional ISO bounds.
 */
export function resolveDatePickerMonthBounds(
  minIso?: string,
  maxIso?: string,
): { startMonth: Date; endMonth: Date } {
  const nowYear = new Date().getFullYear();
  const minYear = parseIsoYear(minIso);
  const maxYear = parseIsoYear(maxIso);
  return {
    startMonth: new Date(minYear ?? nowYear - DATE_PICKER_YEAR_PAST, 0),
    endMonth: new Date(maxYear ?? nowYear + DATE_PICKER_YEAR_FUTURE, 11),
  };
}
