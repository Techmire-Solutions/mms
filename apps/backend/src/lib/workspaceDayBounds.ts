/**
 * @file workspaceDayBounds.ts
 * @description Workspace-timezone day boundaries for due-date filters (m5).
 *
 * A date-only filter (`dueFrom`/`dueTo`/`dueOn`) denotes a calendar day in the
 * workspace's timezone, not UTC. These helpers convert `YYYY-MM-DD` to the UTC
 * instant of that day's midnight using `Intl` (no external timezone library).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Minutes east of UTC for `date` when rendered in `timeZone`. */
export function timezoneOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) map[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

/** UTC instant of the workspace-local midnight of `day` (`YYYY-MM-DD`). */
export function workspaceDayStartUtc(day: string, timeZone: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, date));
  const offset = timezoneOffsetMinutes(timeZone, guess);
  return new Date(guess.getTime() - offset);
}

/** `YYYY-MM-DD` of the day after `day`. */
export function nextIsoDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10);
}

export function isIsoDateOnly(value: string): boolean {
  return DATE_RE.test(value);
}

/** Renders an ISO instant as `YYYY-MM-DD` in the given IANA timezone. */
export function formatIsoDateInTimezone(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}`;
}
