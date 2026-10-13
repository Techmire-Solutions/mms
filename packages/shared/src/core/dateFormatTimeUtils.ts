import { formatDateToIso, parseIsoDate } from "./dateFormatIsoUtils.js";

export interface TimeHHmmParts {
  hours: number;
  minutes: number;
}

/**
 * Parses `HH:mm` or `HH:mm:ss` into hours/minutes.
 * Returns `null` when the string is missing or not a valid clock time.
 */
export function parseTimeHHmm(value: string): TimeHHmmParts | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return { hours, minutes };
}

/** Formats hours/minutes as a zero-padded `HH:mm` storage string. */
export function formatTimeHHmm(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Normalizes a browser time value to `HH:mm`, or `""` when empty/invalid.
 * Accepts `HH:mm` and `HH:mm:ss`.
 */
export function normalizeTimeHHmm(value: string): string {
  const parsed = parseTimeHHmm(value);
  if (!parsed) return "";
  return formatTimeHHmm(parsed.hours, parsed.minutes);
}

export interface IsoDateTimeParts {
  date: string;
  time: string;
}

/**
 * Splits an ISO datetime into local-calendar `YYYY-MM-DD` + `HH:mm` for picker UI.
 * Returns `null` when the value cannot be parsed as a valid Date.
 */
export function splitIsoDateTime(iso: string): IsoDateTimeParts | null {
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    date: formatDateToIso(parsed),
    time: formatTimeHHmm(parsed.getHours(), parsed.getMinutes()),
  };
}

/**
 * Combines local-calendar `YYYY-MM-DD` + `HH:mm` into an ISO-8601 string.
 * Empty date returns `null`. Missing/invalid time defaults to `00:00`.
 */
export function combineIsoDateAndTime(date: string, time: string): string | null {
  const datePart = date.trim();
  if (!datePart) return null;
  const localDate = parseIsoDate(datePart);
  if (!localDate) return null;
  const timeParts = parseTimeHHmm(time.trim() || "00:00") ?? { hours: 0, minutes: 0 };
  localDate.setHours(timeParts.hours, timeParts.minutes, 0, 0);
  return localDate.toISOString();
}
