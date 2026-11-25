import { describe, expect, it } from "vitest";
import {
  findStudentTimetableCollisions,
  findTimetableCollisions,
  parseClockMinutes,
  periodTimeErrors,
  periodsOverlap,
  type TimetablePeriodLike,
} from "./timetableCollisions.js";

const period = (startTime: string, endTime: string, facultyId?: string): TimetablePeriodLike => ({
  startTime,
  endTime,
  ...(facultyId ? { facultyId } : {}),
});

describe("parseClockMinutes", () => {
  it("accepts 24h clock values", () => {
    expect(parseClockMinutes("09:30")).toBe(570);
    expect(parseClockMinutes("9:05")).toBe(545);
    expect(parseClockMinutes("00:00")).toBe(0);
    expect(parseClockMinutes("23:59")).toBe(1439);
  });

  it("rejects invalid values", () => {
    expect(parseClockMinutes("24:00")).toBeNull();
    expect(parseClockMinutes("9:5")).toBeNull();
    expect(parseClockMinutes("nine")).toBeNull();
    expect(parseClockMinutes(undefined)).toBeNull();
  });
});

describe("periodTimeErrors", () => {
  it("flags invalid and reversed periods", () => {
    expect(periodTimeErrors([period("08:00", "09:00")])).toEqual([]);
    expect(periodTimeErrors([period("8:00", "9:00")])).toEqual([]);
    expect(periodTimeErrors([period("25:00", "09:00")])).toEqual([
      { index: 0, reason: "invalid_time" },
    ]);
    expect(periodTimeErrors([period("10:00", "10:00")])).toEqual([
      { index: 0, reason: "end_before_start" },
    ]);
  });
});

describe("periodsOverlap", () => {
  it("treats the end as exclusive", () => {
    expect(periodsOverlap({ start: 540, end: 600 }, { start: 600, end: 660 })).toBe(false);
    expect(periodsOverlap({ start: 540, end: 610 }, { start: 600, end: 660 })).toBe(true);
  });
});

describe("findTimetableCollisions", () => {
  const cls = (id: string, date: string | null, periods: TimetablePeriodLike[]) => ({
    id,
    name: id,
    timetables: [{ date, periods }],
  });

  it("detects overlapping periods of the same class on the same date", () => {
    const collisions = findTimetableCollisions([
      cls("c1", "2026-04-01", [period("08:00", "09:30", "f1"), period("09:00", "10:00", "f2")]),
    ]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toMatchObject({ kind: "period_overlap", classId: "c1" });
  });

  it("detects a teacher booked in two classes at the same time", () => {
    const collisions = findTimetableCollisions([
      cls("c1", "2026-04-01", [period("08:00", "09:00", "f1")]),
      cls("c2", "2026-04-01", [period("08:30", "09:30", "f1")]),
    ]);
    expect(collisions).toEqual([
      expect.objectContaining({ kind: "faculty_double_booked", classId: "c1" }),
    ]);
  });

  it("ignores different dates and undated templates", () => {
    expect(
      findTimetableCollisions([
        cls("c1", "2026-04-01", [period("08:00", "09:00", "f1")]),
        cls("c2", "2026-04-02", [period("08:00", "09:00", "f1")]),
        cls("c3", null, [period("08:00", "09:00", "f1")]),
      ]),
    ).toEqual([]);
  });
});

describe("findStudentTimetableCollisions", () => {
  const cls = (id: string, date: string, periods: TimetablePeriodLike[]) => ({
    id,
    name: id,
    timetables: [{ date, periods }],
  });

  it("flags a target class that overlaps another enrolled class", () => {
    const collisions = findStudentTimetableCollisions(
      cls("target", "2026-04-01", [period("08:00", "09:00")]),
      [cls("other", "2026-04-01", [period("08:30", "09:30")])],
    );
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toMatchObject({
      kind: "student_time_overlap",
      classId: "target",
      otherClassId: "other",
    });
  });

  it("allows back-to-back classes", () => {
    expect(
      findStudentTimetableCollisions(cls("target", "2026-04-01", [period("08:00", "09:00")]), [
        cls("other", "2026-04-01", [period("09:00", "10:00")]),
      ]),
    ).toEqual([]);
  });
});
