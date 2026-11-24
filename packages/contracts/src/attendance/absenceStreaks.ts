import type { AttendanceRecordStatus } from "./attendanceModuleManifest.js";

/**
 * Chronic-absence (defaulter) detection.
 *
 * A streak is a run of consecutive **countable, marked** days that are all unexcused absences.
 * Anything else ends it:
 *   - `present` / `late` — the student was there;
 *   - `excused` — the absence is authorised;
 *   - an **unmarked** day or a non-instructional day — there is no evidence, and a data gap must not
 *     be read as absence. (Unmarked days are reported separately by the completion gate.)
 *
 * The function is pure so the escalation job, any report and the tests share one definition.
 */

export interface AbsenceStreakDay {
  /** `YYYY-MM-DD`. */
  date: string;
  /** The marked status, or `null` when the day is countable but unmarked. */
  status: AttendanceRecordStatus | null;
  /** False for holidays / weekly off-days / approved leave (excluded before it reaches this helper). */
  countable?: boolean;
}

export interface AbsenceStreak {
  startDate: string;
  endDate: string;
  length: number;
  /** The dates in the streak, in order. */
  dates: readonly string[];
}

export function isUnexcusedAbsence(status: AttendanceRecordStatus | null | undefined): boolean {
  return status === "absent";
}

/**
 * Streaks of at least `threshold` consecutive unexcused absences, oldest first.
 *
 * Days may arrive in any order; they are evaluated in ascending date order after filtering.
 */
export function findAbsenceStreaks(
  days: readonly AbsenceStreakDay[],
  threshold: number,
): AbsenceStreak[] {
  const minimum = Math.max(1, Math.trunc(threshold));
  const ordered = [...days]
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  const streaks: AbsenceStreak[] = [];
  let current: string[] = [];

  const flush = (): void => {
    if (current.length >= minimum) {
      streaks.push({
        startDate: current[0]!,
        endDate: current[current.length - 1]!,
        length: current.length,
        dates: [...current],
      });
    }
    current = [];
  };

  for (const day of ordered) {
    // A non-countable day (holiday, off-day, approved leave) interrupts the calendar run: Monday and
    // Tuesday absent, an excused Wednesday, then Thursday absent is not "three consecutive".
    if (day.countable === false) {
      flush();
      continue;
    }
    if (isUnexcusedAbsence(day.status)) {
      current.push(day.date);
      continue;
    }
    // A marked non-absence or an unmarked day also ends the run.
    flush();
  }
  flush();

  return streaks;
}

/** Stable idempotency key for one streak (matches the alert table's unique index). */
export function absenceAlertKey(input: {
  classId: string;
  studentId: string;
  startDate: string;
}): string {
  return `${input.classId}|${input.studentId}|${input.startDate.slice(0, 10)}`;
}

/** The alert is recomputed on every scan; only an `open` alert should notify. */
export function shouldNotifyAbsenceAlert(status: string | null | undefined): boolean {
  return !status || status === "open";
}
