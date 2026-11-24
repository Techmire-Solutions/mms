import { describe, expect, it } from "vitest";
import {
  addIsoDays,
  instructionalDayDecision,
  isInstructionalDay,
  isoDaysBetween,
  isoWeekday,
  listInstructionalDays,
  weekdayIndexes,
  type CalendarEventLite,
  type InstructionalDayContext,
} from "./academicCalendar.js";
import { academicCalendarEventWriteSchema } from "./academicCalendarTypes.js";

const MON_FRI = weekdayIndexes(["monday", "tuesday", "wednesday", "thursday", "friday"]);

function event(overrides: Partial<CalendarEventLite>): CalendarEventLite {
  return {
    kind: "holiday",
    startOn: "2026-03-02",
    endOn: "2026-03-02",
    scope: "workspace",
    sessionId: null,
    classId: null,
    sectionId: null,
    ...overrides,
  };
}

describe("weekday helpers", () => {
  it("given names and dates, should map weekdays and add days across month and DST edges", () => {
    // Assert
    expect(weekdayIndexes(["Friday", "monday", "bogus", "monday"])).toEqual([1, 5]);
    expect(isoWeekday("2026-03-02")).toBe(1);
    expect(addIsoDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addIsoDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addIsoDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});

describe("instructionalDayDecision", () => {
  it("given no events, should follow the weekly pattern", () => {
    // Arrange
    const ctx: InstructionalDayContext = { workingWeekdays: MON_FRI, events: [] };

    // Assert
    expect(isInstructionalDay("2026-03-02", ctx)).toBe(true);
    expect(isInstructionalDay("2026-03-07", ctx)).toBe(false);
  });

  it("given a workspace holiday and a narrower make-up day, should let the narrower scope win", () => {
    // Arrange
    const ctx: InstructionalDayContext = {
      workingWeekdays: MON_FRI,
      events: [
        event({ title: "Eid" }),
        event({ kind: "makeup_day", scope: "class", classId: "c1" }),
      ],
      scope: { sessionId: "s1", classId: "c1" },
    };

    // Act
    const forClass = instructionalDayDecision("2026-03-02", ctx);
    const forOtherClass = instructionalDayDecision("2026-03-02", {
      ...ctx,
      scope: { sessionId: "s1", classId: "c2" },
    });

    // Assert
    expect(forClass.instructional).toBe(true);
    expect(forOtherClass).toEqual({
      instructional: false,
      event: expect.objectContaining({ title: "Eid" }),
    });
  });

  it("given a make-up Saturday and a holiday at the same scope, should prefer the holiday", () => {
    // Arrange
    const ctx: InstructionalDayContext = {
      workingWeekdays: MON_FRI,
      events: [
        event({ kind: "makeup_day", startOn: "2026-03-07", endOn: "2026-03-07" }),
        event({ startOn: "2026-03-07", endOn: "2026-03-08" }),
      ],
    };

    // Assert
    expect(isInstructionalDay("2026-03-07", { ...ctx, events: [ctx.events[0]] })).toBe(true);
    expect(isInstructionalDay("2026-03-07", ctx)).toBe(false);
  });

  it("given exam periods and events, should not change instructional status", () => {
    // Arrange
    const ctx: InstructionalDayContext = {
      workingWeekdays: MON_FRI,
      events: [
        event({ kind: "exam_period" }),
        event({ kind: "event", startOn: "2026-03-07", endOn: "2026-03-07" }),
      ],
    };

    // Assert
    expect(listInstructionalDays("2026-03-02", "2026-03-08", ctx)).toEqual([
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
    ]);
  });

  it("given a session-scoped holiday range, should only apply to that session", () => {
    // Arrange
    const ctx: InstructionalDayContext = {
      workingWeekdays: [0, 6],
      events: [
        event({
          scope: "session",
          sessionId: "s-weekend",
          startOn: "2026-03-07",
          endOn: "2026-03-08",
        }),
      ],
      scope: { sessionId: "s-weekend" },
    };

    // Assert
    expect(listInstructionalDays("2026-03-01", "2026-03-15", ctx)).toEqual([
      "2026-03-01",
      "2026-03-14",
      "2026-03-15",
    ]);
  });
});

describe("academicCalendarEventWriteSchema", () => {
  it("given an inverted range or a missing scope id, should reject", () => {
    // Act
    const inverted = academicCalendarEventWriteSchema.safeParse({
      title: "X",
      kind: "holiday",
      startOn: "2026-03-05",
      endOn: "2026-03-01",
    });
    const missing = academicCalendarEventWriteSchema.safeParse({
      title: "X",
      kind: "holiday",
      startOn: "2026-03-01",
      endOn: "2026-03-01",
      scope: "class",
    });
    const ok = academicCalendarEventWriteSchema.parse({
      title: " Eid ",
      kind: "holiday",
      startOn: "2026-03-01",
      endOn: "2026-03-03",
      notes: "",
    });

    // Assert
    expect(inverted.success).toBe(false);
    expect(missing.success).toBe(false);
    expect(ok).toEqual({
      title: "Eid",
      kind: "holiday",
      startOn: "2026-03-01",
      endOn: "2026-03-03",
      scope: "workspace",
      sessionId: null,
      classId: null,
      sectionId: null,
      notes: null,
    });
  });
});

describe("isoDaysBetween", () => {
  it("counts whole days forward", () => {
    expect(isoDaysBetween("2026-01-01", "2026-01-11")).toBe(10);
  });

  it("returns zero for the same day", () => {
    expect(isoDaysBetween("2026-03-05", "2026-03-05")).toBe(0);
  });

  it("returns a negative count when the end precedes the start", () => {
    expect(isoDaysBetween("2026-01-11", "2026-01-01")).toBe(-10);
  });

  it("is unaffected by a DST boundary between the dates", () => {
    // Most northern-hemisphere zones shift clocks inside this window.
    expect(isoDaysBetween("2026-03-01", "2026-04-01")).toBe(31);
  });

  it("spans a leap day", () => {
    expect(isoDaysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("returns null for unusable input", () => {
    expect(isoDaysBetween("nope", "2026-01-01")).toBeNull();
    expect(isoDaysBetween("2026-01-01", "nope")).toBeNull();
  });
});
