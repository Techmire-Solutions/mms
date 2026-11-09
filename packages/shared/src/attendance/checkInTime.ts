/**
 * Device check-in timestamp handling.
 *
 * RFID/biometric readers send three shapes in practice: a wall-clock `HH:mm`, a full ISO timestamp
 * with an offset, or epoch milliseconds. All three are normalised to a workspace business day + a
 * 24-hour `HH:mm` so the row can be matched against the attendance natural key.
 */

export interface ParsedCheckInTime {
  /** Business day (YYYY-MM-DD) in the workspace timezone. */
  date: string;
  /** 24-hour wall clock (HH:mm). */
  time: string;
}

export type CheckInTimeError =
  "invalid_timestamp" | "ambiguous_time" | "date_in_future" | "date_too_old";

export type CheckInTimeResult =
  { ok: true; value: ParsedCheckInTime } | { ok: false; code: CheckInTimeError; message: string };

const HHMM = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EPOCH_MS = /^\d{10,14}$/;

/** `HH:mm` in the workspace timezone for an instant. */
function clockInZone(instant: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(instant);
  } catch {
    return instant.toISOString().slice(11, 16);
  }
}

/** Calendar day in the workspace timezone for an instant. */
function dayInZone(instant: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

function isoDaysApart(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

/**
 * Normalises one device timestamp.
 *
 * @param raw  `HH:mm`, `HH:mm:ss`, ISO-8601, or epoch millis.
 * @param date The date supplied by the caller (required for a bare wall clock).
 * @param options.today Workspace business day, for the future/old checks.
 * @param options.maxAgeDays Late-upload window (a device may queue offline).
 */
export function parseCheckInTime(
  raw: string,
  date: string | undefined,
  options: { timeZone: string; today: string; maxAgeDays: number },
): CheckInTimeResult {
  const value = raw.trim();
  if (!value) {
    return { ok: false, code: "invalid_timestamp", message: "timeIn is empty" };
  }

  // Bare clock: requires the caller's date.
  const clock = HHMM.exec(value);
  if (clock) {
    const hours = Number(clock[1]);
    const minutes = Number(clock[2]);
    const seconds = clock[3] ? Number(clock[3]) : 0;
    if (hours > 23 || minutes > 59 || seconds > 59) {
      return { ok: false, code: "invalid_timestamp", message: `Invalid time: ${value}` };
    }
    if (!date) {
      return {
        ok: false,
        code: "ambiguous_time",
        message: "A bare HH:mm needs an explicit date",
      };
    }
    const normalised = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const age = isoDaysApart(options.today, date);
    if (age < 0) {
      return { ok: false, code: "date_in_future", message: `Date ${date} is in the future` };
    }
    if (age > options.maxAgeDays) {
      return {
        ok: false,
        code: "date_too_old",
        message: `Date ${date} is older than ${options.maxAgeDays} days`,
      };
    }
    return { ok: true, value: { date, time: normalised } };
  }

  // Epoch millis.
  if (EPOCH_MS.test(value)) {
    const instant = new Date(Number(value));
    if (Number.isNaN(instant.getTime())) {
      return { ok: false, code: "invalid_timestamp", message: `Invalid epoch: ${value}` };
    }
    return finaliseInstant(instant, options);
  }

  // ISO timestamp with an offset or Z.
  if (/T/.test(value)) {
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) {
      return { ok: false, code: "invalid_timestamp", message: `Invalid timestamp: ${value}` };
    }
    if (date && ISO_DATE.test(date) && dayInZone(instant, options.timeZone) !== date) {
      return {
        ok: false,
        code: "ambiguous_time",
        message: `Timestamp falls on ${dayInZone(instant, options.timeZone)}, not ${date}`,
      };
    }
    return finaliseInstant(instant, options);
  }

  return { ok: false, code: "invalid_timestamp", message: `Unrecognised time: ${value}` };
}

function finaliseInstant(
  instant: Date,
  options: { timeZone: string; today: string; maxAgeDays: number },
): CheckInTimeResult {
  const day = dayInZone(instant, options.timeZone);
  const age = isoDaysApart(options.today, day);
  if (age < 0) {
    return {
      ok: false,
      code: "date_in_future",
      message: `Timestamp falls on ${day}, in the future`,
    };
  }
  if (age > options.maxAgeDays) {
    return {
      ok: false,
      code: "date_too_old",
      message: `Timestamp falls on ${day}, older than ${options.maxAgeDays} days`,
    };
  }
  return { ok: true, value: { date: day, time: clockInZone(instant, options.timeZone) } };
}
