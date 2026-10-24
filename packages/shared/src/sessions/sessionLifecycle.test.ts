import { describe, expect, it } from "vitest";
import {
  canTransitionSession,
  findSessionEditViolations,
  isSessionStructureLocked,
  normalizeSessionStatus,
} from "./sessionLifecycle.js";
import { SessionSchema, type Session } from "./sessionTypes.js";

function session(overrides: Partial<Session> & { status: string }): Session {
  return SessionSchema.parse({
    id: "ses-1",
    name: "Hifz 2026",
    startDate: "2026-01-01",
    categoryId: "cat-1",
    programId: "p-1",
    classes: [
      {
        id: "cls-1",
        name: "Darja 1",
        gender: "male",
        minAge: 6,
        maxAge: 12,
        enrolled: 5,
        sections: [
          { id: "sec-a", name: "A", capacity: 10, enrolled: 5 },
          { id: "sec-b", name: "B", capacity: 10, enrolled: 0 },
        ],
      },
    ],
    ...overrides,
  });
}

describe("normalizeSessionStatus / canTransitionSession", () => {
  it("given legacy statuses, should map onto the lifecycle and gate transitions", () => {
    // Arrange / Act / Assert
    expect(
      ["active", "upcoming", "inactive", "cancelled", "weird"].map(normalizeSessionStatus),
    ).toEqual(["in_progress", "open", "archived", "cancelled", "draft"]);
    expect(canTransitionSession("open", "in_progress")).toBe(true);
    expect(canTransitionSession("completed", "in_progress")).toBe(false);
    expect(canTransitionSession("archived", "draft")).toBe(false);
    expect(isSessionStructureLocked("open")).toBe(false);
    expect(isSessionStructureLocked("active")).toBe(true);
  });
});

describe("findSessionEditViolations", () => {
  it("given an open session, should allow structural changes", () => {
    // Arrange
    const before = session({ status: "open" });

    // Act
    const violations = findSessionEditViolations(before, {
      ...before,
      startDate: "2026-02-01",
      classes: [],
    });

    // Assert
    expect(violations).toEqual([]);
  });

  it("given an in-progress session, should block start date, eligibility, removals and capacity below enrolled", () => {
    // Arrange
    const before = session({ status: "in_progress" });
    const cls = before.classes[0];

    // Act
    const violations = findSessionEditViolations(before, {
      ...before,
      startDate: "2026-02-01",
      classes: [{ ...cls, minAge: 5, sections: [{ ...cls.sections![0], capacity: 3 }] }],
    });

    // Assert
    expect(violations.sort()).toEqual([
      "capacityBelowEnrolled",
      "eligibility",
      "sectionRemoved",
      "startDate",
    ]);
  });

  it("given an in-progress session, should allow adding a section, raising capacity and extending the end date", () => {
    // Arrange
    const before = session({ status: "in_progress" });
    const cls = before.classes[0];

    // Act
    const violations = findSessionEditViolations(before, {
      ...before,
      endDate: "2026-12-31",
      classes: [
        {
          ...cls,
          sections: [
            ...cls.sections!.map((s) => ({ ...s, capacity: 20 })),
            { id: "sec-c", name: "C", capacity: 10, room: "", status: "active" },
          ],
        },
      ],
    });

    // Assert
    expect(violations).toEqual([]);
  });

  it("given a completed session, should flag any material change as read-only but ignore derived counters", () => {
    // Arrange
    const before = session({ status: "completed" });

    // Act
    const derivedOnly = findSessionEditViolations(before, {
      ...before,
      classes: before.classes.map((c) => ({ ...c, enrolled: 99 })),
    });
    const renamed = findSessionEditViolations(before, { ...before, name: "Renamed" });

    // Assert
    expect(derivedOnly).toEqual([]);
    expect(renamed).toEqual(["readOnly"]);
  });

  it("given an in-progress session and today, should lock past timetables but not today or later", () => {
    // Arrange
    const period = { id: "p1", startTime: "08:00", endTime: "09:00", subject: "Quran" };
    const timetables = [
      { id: "tt-past", date: "2026-03-01", periods: [period] },
      { id: "tt-today", date: "2026-03-10", periods: [period] },
    ];
    const base = session({ status: "in_progress" });
    const before = SessionSchema.parse({
      ...base,
      classes: base.classes.map((cls) => ({ ...cls, timetables })),
    });
    const editTimetable = (id: string, subject: string): Session =>
      SessionSchema.parse({
        ...before,
        classes: before.classes.map((cls) => ({
          ...cls,
          timetables: cls.timetables.map((timetable) =>
            timetable.id === id
              ? { ...timetable, periods: [{ ...period, subject, facultyId: "", facultyName: "" }] }
              : timetable,
          ),
        })),
      });

    // Act
    const pastEdit = findSessionEditViolations(
      before,
      editTimetable("tt-past", "Hadith"),
      "2026-03-10",
    );
    const todayEdit = findSessionEditViolations(
      before,
      editTimetable("tt-today", "Hadith"),
      "2026-03-10",
    );
    const pastRemoved = findSessionEditViolations(
      before,
      SessionSchema.parse({
        ...before,
        classes: before.classes.map((cls) => ({ ...cls, timetables: [] })),
      }),
      "2026-03-10",
    );
    const withoutToday = findSessionEditViolations(before, editTimetable("tt-past", "Hadith"));

    // Assert
    expect(pastEdit).toEqual(["pastTimetable"]);
    expect(todayEdit).toEqual([]);
    expect(pastRemoved).toEqual(["pastTimetable"]);
    expect(withoutToday).toEqual([]);
  });
});
