/**
 * Converts a wall-clock date/time in an IANA timezone to the corresponding UTC instant.
 * Uses `Intl.DateTimeFormat` (no timezone dependency); iterates twice so DST boundaries resolve
 * against the offset in effect at the resulting instant.
 */
export interface ZonedDateTimeParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  timeZone: string;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function offsetMsAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

export function zonedDateTimeToUtc({ date, time, timeZone }: ZonedDateTimeParts): Date {
  const dateMatch = DATE_RE.exec(date);
  const timeMatch = TIME_RE.exec(time);
  if (!dateMatch || !timeMatch)
    throw new Error(`Invalid date/time "${date} ${time}" (expected YYYY-MM-DD and HH:mm)`);
  if (!timeZone.trim()) throw new Error("Workspace timezone is required");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new Error(`Invalid workspace timezone "${timeZone}"`);
  }
  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const naive = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  // First pass resolves the offset at the naive instant; second pass resolves the offset that
  // applies at the converted instant (covers the spring-forward/fall-back edges).
  let instant = new Date(naive - offsetMsAt(new Date(naive), timeZone));
  instant = new Date(naive - offsetMsAt(instant, timeZone));
  return instant;
}

/** RFC 5545 UTC timestamp: `YYYYMMDDTHHMMSSZ`. */
export function formatIcalUtc(instant: Date): string {
  return instant
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/** Adds whole days to an ISO date without using the process timezone. */
export function addIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}
