import { buildCsvContent, type AcademicCalendarEvent } from "@mms/shared";
import { streamIcalCalendar } from "../../lib/icalFormat.js";

const CSV_HEADER = [
  "title",
  "kind",
  "startOn",
  "endOn",
  "scope",
  "sessionId",
  "classId",
  "sectionId",
  "notes",
];

export function* streamAcademicCalendarCsv(
  events: AcademicCalendarEvent[],
): Generator<string, void, undefined> {
  yield buildCsvContent([CSV_HEADER]);
  for (const event of events) {
    yield `\n${buildCsvContent([
      [
        event.title,
        event.kind,
        event.startOn,
        event.endOn,
        event.scope,
        event.sessionId ?? "",
        event.classId ?? "",
        event.sectionId ?? "",
        event.notes ?? "",
      ],
    ])}`;
  }
}

export function* streamAcademicCalendarIcs(
  events: AcademicCalendarEvent[],
  timeZone: string,
): Generator<string, void, undefined> {
  yield* streamIcalCalendar(
    { name: "Academic calendar", timeZone },
    events.map((event) => ({
      uid: `academic-calendar-${event.id}`,
      startOn: event.startOn,
      endOn: event.endOn,
      summary: event.title,
      description: event.notes ?? null,
      categories: [event.kind, event.scope],
    })),
  );
}
