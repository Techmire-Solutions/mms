import { buildCsvContent, type Session, type SessionsTimetableExportQuery } from "@mms/shared";
import { streamIcalCalendar, type TimedIcalEvent } from "../../lib/icalFormat.js";
import { zonedDateTimeToUtc } from "../../lib/zonedTime.js";
import { ValidationError } from "../../lib/httpErrors.js";

export interface TimetableExportOptions extends SessionsTimetableExportQuery {
  timeZone: string;
}

function validTime(value: string): string | null {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

/**
 * Resolves the export range: query bounds are clamped to the session dates; an inverted range is
 * rejected. Only dated timetables inside the range are exported.
 */
export function resolveTimetableRange(
  session: Session,
  query: SessionsTimetableExportQuery,
): { from: string; to: string; classId?: string } {
  const sessionFrom = session.startDate || "";
  const sessionTo = session.endDate || "";
  const from = query.from || sessionFrom;
  const to = query.to || sessionTo;
  if (!from || !to) throw new ValidationError("A timetable date range is required");
  if (from > to) throw new ValidationError("from must be before or equal to to");
  const boundedFrom = sessionFrom && from < sessionFrom ? sessionFrom : from;
  const boundedTo = sessionTo && to > sessionTo ? sessionTo : to;
  if (boundedFrom > boundedTo) throw new ValidationError("The range is outside the session dates");
  return { from: boundedFrom, to: boundedTo, classId: query.classId };
}

interface TimetableRow {
  periodId: string;
  classId: string;
  className: string;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  faculty: string;
}

function* timetableRows(
  session: Session,
  options: TimetableExportOptions,
): Generator<TimetableRow, void, undefined> {
  const range = resolveTimetableRange(session, options);
  for (const cls of session.classes ?? []) {
    if (range.classId && cls.id !== range.classId) continue;
    for (const timetable of cls.timetables ?? []) {
      if (!timetable.date || timetable.date < range.from || timetable.date > range.to) continue;
      for (const period of timetable.periods ?? []) {
        const startTime = validTime(period.startTime);
        const endTime = validTime(period.endTime);
        if (!startTime || !endTime || startTime >= endTime) continue;
        yield {
          periodId: period.id,
          classId: cls.id,
          className: cls.name,
          room: cls.room || "",
          date: timetable.date,
          startTime,
          endTime,
          subject: period.subject || "",
          faculty: period.facultyName || cls.facultyName || "",
        };
      }
    }
  }
}

const TIMETABLE_CSV_HEADER = [
  "date",
  "weekday",
  "class",
  "startTime",
  "endTime",
  "subject",
  "faculty",
  "room",
  "timezone",
];

function weekdayOf(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

export function* streamTimetableCsv(
  session: Session,
  options: TimetableExportOptions,
): Generator<string, void, undefined> {
  yield buildCsvContent([TIMETABLE_CSV_HEADER]);
  for (const row of timetableRows(session, options)) {
    yield `\n${buildCsvContent([
      [
        row.date,
        weekdayOf(row.date),
        row.className,
        row.startTime,
        row.endTime,
        row.subject,
        row.faculty,
        row.room,
        options.timeZone,
      ],
    ])}`;
  }
}

export function* streamTimetableIcs(
  session: Session,
  options: TimetableExportOptions,
): Generator<string, void, undefined> {
  function* events(): Generator<TimedIcalEvent, void, undefined> {
    for (const row of timetableRows(session, options)) {
      let startUtc: Date;
      let endUtc: Date;
      try {
        startUtc = zonedDateTimeToUtc({
          date: row.date,
          time: row.startTime,
          timeZone: options.timeZone,
        });
        endUtc = zonedDateTimeToUtc({
          date: row.date,
          time: row.endTime,
          timeZone: options.timeZone,
        });
      } catch {
        // A corrupt stored time should skip one period, not fail the whole calendar export.
        continue;
      }
      yield {
        uid: `timetable-${session.id}-${row.classId}-${row.date}-${row.periodId}`,
        startUtc,
        endUtc,
        summary: row.subject ? `${row.className} — ${row.subject}` : row.className,
        description: row.faculty ? `Teacher: ${row.faculty}` : null,
        location: row.room || null,
      };
    }
  }
  yield* streamIcalCalendar(
    { name: `${session.name} timetable`, timeZone: options.timeZone },
    events(),
  );
}
