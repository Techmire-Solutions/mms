import { describe, expect, it } from "vitest";
import type { Session } from "@mms/shared";
import {
  streamTimetableCsv,
  streamTimetableIcs,
} from "../sessions/use-cases/sessionTimetableExport.js";
import {
  streamAcademicCalendarCsv,
  streamAcademicCalendarIcs,
} from "../attendance/use-cases/academicCalendarExport.js";

function session(): Session {
  return {
    id: "sess-1",
    name: "Hifz 2026",
    status: "in_progress",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    classes: [
      {
        id: "c1",
        name: "Class A",
        room: "Room 1",
        facultyName: "Ustadh",
        timetables: [
          {
            id: "tt1",
            date: "2026-07-01",
            periods: [
              {
                id: "p1",
                startTime: "09:00",
                endTime: "10:00",
                subject: "Tajweed",
                facultyName: "Ustadh",
              },
            ],
          },
          {
            id: "tt2",
            date: "2026-07-02",
            periods: [{ id: "p2", startTime: "11:00", endTime: "12:00", subject: "Fiqh" }],
          },
        ],
      },
    ],
  } as unknown as Session;
}

describe("timetable exports", () => {
  it("streams CSV rows bounded by the session range and escapes formula cells", () => {
    const text = Array.from(
      streamTimetableCsv({ ...session(), name: "=HYPERLINK()" } as Session, {
        timeZone: "Asia/Karachi",
      }),
    ).join("");
    expect(text).toContain('"date","weekday","class"');
    expect(text).toContain("2026-07-01");
    expect(text).toContain("Tajweed");
    expect(text).toContain("Asia/Karachi");
  });

  it("converts timetable wall times to UTC in ICS", () => {
    const text = Array.from(streamTimetableIcs(session(), { timeZone: "Asia/Karachi" })).join("");
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("DTSTART:20260701T040000Z");
    expect(text).toContain("DTEND:20260701T050000Z");
    expect(text).toContain("SUMMARY:Class A — Tajweed");
    expect(text).toContain("LOCATION:Room 1");
  });

  it("rejects an inverted range before streaming", () => {
    expect(() =>
      Array.from(
        streamTimetableCsv(session(), { from: "2026-08-01", to: "2026-07-01", timeZone: "UTC" }),
      ),
    ).toThrow();
  });
});

describe("academic calendar exports", () => {
  const events = [
    {
      id: "e1",
      title: "Eid holiday",
      kind: "holiday",
      startOn: "2026-03-20",
      endOn: "2026-03-22",
      scope: "workspace",
      sessionId: null,
      classId: null,
      sectionId: null,
      notes: null,
      deletedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ] as const;

  it("streams CSV with a header and escaped values", () => {
    const text = Array.from(streamAcademicCalendarCsv([...events])).join("");
    expect(text.split("\n")[0]).toContain('"title","kind","startOn"');
    expect(text).toContain("Eid holiday");
  });

  it("emits all-day events with an exclusive DTEND", () => {
    const text = Array.from(streamAcademicCalendarIcs([...events], "UTC")).join("");
    expect(text).toContain("DTSTART;VALUE=DATE:20260320");
    expect(text).toContain("DTEND;VALUE=DATE:20260323");
  });
});
