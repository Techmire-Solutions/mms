import { isValidIsoDate } from "@mms/shared";
import { ValidationError } from "./httpErrors.js";

/**
 * Value for a Postgres `date` column (Drizzle `mode: 'string'`): the `YYYY-MM-DD` part of the input
 * when it is a real calendar date, otherwise NULL. Empty strings must never reach a `date` column.
 */
export function toDbDate(value: string | null | undefined): string | null {
  const day = (value ?? "").trim().slice(0, 10);
  return isValidIsoDate(day) ? day : null;
}

/** Today's calendar day (`YYYY-MM-DD`) in an IANA timezone; unknown zones fall back to UTC. */
export function todayInTimeZone(
  timeZone: string | null | undefined,
  now: Date = new Date(),
): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * Strict form of {@link toDbDate} for writes: empty → NULL, a real date → `YYYY-MM-DD`, anything
 * else is rejected (400) instead of being stored as NULL, so no typed value is silently lost.
 */
export function requireDbDate(value: string | null | undefined, field: string): string | null {
  if (!(value ?? "").trim()) return null;
  const day = toDbDate(value);
  if (!day) throw new ValidationError(`${field} must be a date (YYYY-MM-DD)`);
  return day;
}
