/**
 * Timetable time-slot validation.
 *
 * Periods are stored as free-form `start_time`/`end_time` strings on a *dated* timetable
 * (`session_class_timetables.date` + `session_class_timetable_periods`). Nothing validated
 * them before: "9:00", "25:99", start > end and two periods covering the same slot were all
 * accepted. These helpers are pure so session persistence and enrollment writes share one
 * definition.
 */

export interface TimetablePeriodLike {
  startTime?: string | null;
  endTime?: string | null;
  subjectId?: string | null;
  facultyId?: string | null;
}

export interface DatedTimetableLike {
  date?: string | null;
  periods?: readonly TimetablePeriodLike[];
}

export interface ClassTimetableLike {
  id: string;
  name?: string;
  timetables?: readonly DatedTimetableLike[];
}

const CLOCK = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** `HH:MM` (24h) → minutes since midnight; null when the value is not a valid clock time. */
export function parseClockMinutes(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const match = CLOCK.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Half-open overlap: a period ending at 10:00 does not collide with one starting at 10:00. */
export function periodsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}

export interface PeriodTimeError {
  index: number;
  reason: "invalid_time" | "end_before_start";
}

/** Format/order errors for one period list (indexes refer to the input array). */
export function periodTimeErrors(periods: readonly TimetablePeriodLike[]): PeriodTimeError[] {
  const errors: PeriodTimeError[] = [];
  periods.forEach((period, index) => {
    const start = parseClockMinutes(period.startTime);
    const end = parseClockMinutes(period.endTime);
    if (start === null || end === null) {
      errors.push({ index, reason: "invalid_time" });
      return;
    }
    if (end <= start) errors.push({ index, reason: "end_before_start" });
  });
  return errors;
}

export interface SlotCollision {
  kind: "period_overlap" | "faculty_double_booked" | "student_time_overlap";
  /** Date of the colliding timetables (null when the timetable is undated). */
  date: string | null;
  classId: string;
  otherClassId: string;
  periodIndex: number;
  otherPeriodIndex: number;
  detail: string;
}

const normaliseDate = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : null;
};

interface SlotEntry {
  classId: string;
  date: string;
  start: number;
  end: number;
  index: number;
  facultyId: string | null;
  subjectId: string | null;
}

function datedEntries(classes: readonly ClassTimetableLike[]): SlotEntry[] {
  const entries: SlotEntry[] = [];
  for (const cls of classes) {
    for (const timetable of cls.timetables ?? []) {
      const date = normaliseDate(timetable.date);
      if (!date) continue;
      (timetable.periods ?? []).forEach((period, index) => {
        const start = parseClockMinutes(period.startTime);
        const end = parseClockMinutes(period.endTime);
        if (start === null || end === null || end <= start) return;
        entries.push({
          classId: cls.id,
          date,
          start,
          end,
          index,
          facultyId: period.facultyId?.trim() || null,
          subjectId: period.subjectId?.trim() || null,
        });
      });
    }
  }
  return entries;
}

/**
 * Collisions across the given classes on shared dates:
 *  - two periods of the **same class** overlapping (a broken timetable), and
 *  - the same **faculty** teaching two overlapping periods on the same date.
 *
 * Undated timetables (templates) are skipped — they cannot collide on a slot.
 */
export function findTimetableCollisions(classes: readonly ClassTimetableLike[]): SlotCollision[] {
  const entries = datedEntries(classes);
  const collisions: SlotCollision[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i]!;
      const b = entries[j]!;
      if (a.date !== b.date) continue;
      if (!periodsOverlap({ start: a.start, end: a.end }, { start: b.start, end: b.end })) continue;
      if (a.classId === b.classId) {
        collisions.push({
          kind: "period_overlap",
          date: a.date,
          classId: a.classId,
          otherClassId: b.classId,
          periodIndex: a.index,
          otherPeriodIndex: b.index,
          detail: `Periods ${a.index + 1} and ${b.index + 1} overlap on ${a.date}`,
        });
        continue;
      }
      if (a.facultyId && a.facultyId === b.facultyId) {
        collisions.push({
          kind: "faculty_double_booked",
          date: a.date,
          classId: a.classId,
          otherClassId: b.classId,
          periodIndex: a.index,
          otherPeriodIndex: b.index,
          detail: `The same teacher is booked in two overlapping periods on ${a.date}`,
        });
      }
    }
  }
  return collisions;
}

/**
 * A student may only attend one class at a time: every target-class period must be free of
 * overlap with the student's other classes on the same date.
 */
export function findStudentTimetableCollisions(
  target: ClassTimetableLike,
  otherClasses: readonly ClassTimetableLike[],
): SlotCollision[] {
  const targetEntries = datedEntries([target]);
  const otherEntries = datedEntries(otherClasses);
  const collisions: SlotCollision[] = [];
  for (const entry of targetEntries) {
    for (const other of otherEntries) {
      if (entry.date !== other.date) continue;
      if (
        !periodsOverlap(
          { start: entry.start, end: entry.end },
          { start: other.start, end: other.end },
        )
      ) {
        continue;
      }
      collisions.push({
        kind: "student_time_overlap",
        date: entry.date,
        classId: entry.classId,
        otherClassId: other.classId,
        periodIndex: entry.index,
        otherPeriodIndex: other.index,
        detail: `This period overlaps another class on ${entry.date}`,
      });
    }
  }
  return collisions;
}
