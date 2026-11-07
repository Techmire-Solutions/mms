import { describe, expect, it } from "vitest";
import { academicCalendarImportBodySchema, sessionTimetableImportBodySchema } from "@mms/shared";

describe("bulk calendar/timetable import schemas", () => {
  it("sanitizes bidi override characters and enforces time order", () => {
    const parsed = sessionTimetableImportBodySchema.safeParse({
      rows: [
        {
          classId: "c1",
          date: "2026-07-01",
          startTime: "10:00",
          endTime: "09:00",
          subject: "Tajweed",
        },
      ],
    });
    expect(parsed.success).toBe(false);

    const sanitized = sessionTimetableImportBodySchema.parse({
      rows: [
        {
          classId: "c1",
          date: "2026-07-01",
          startTime: "09:00",
          endTime: "10:00",
          subject: "Tajweed\u202E",
          subjectId: "sub-1",
        },
      ],
    });
    expect(sanitized.rows[0]?.subject).toBe("Tajweed");
  });

  it("caps imports at 500 rows and validates calendar references via the write schema", () => {
    const rows = Array.from({ length: 501 }, (_, index) => ({
      classId: "c1",
      date: "2026-07-01",
      startTime: "09:00",
      endTime: "10:00",
      subject: "Tajweed",
      subjectId: "sub-1",
      row: index,
    }));
    expect(sessionTimetableImportBodySchema.safeParse({ rows }).success).toBe(false);

    expect(
      academicCalendarImportBodySchema.safeParse({
        rows: [
          {
            title: "Eid",
            kind: "holiday",
            startOn: "2026-03-20",
            endOn: "2026-03-19",
            scope: "workspace",
          },
        ],
      }).success,
    ).toBe(false);
  });
});
