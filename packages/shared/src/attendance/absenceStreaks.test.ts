import { describe, expect, it } from "vitest";
import {
  absenceAlertKey,
  findAbsenceStreaks,
  isUnexcusedAbsence,
  shouldNotifyAbsenceAlert,
  type AbsenceStreakDay,
} from "./absenceStreaks.js";

const day = (date: string, status: AbsenceStreakDay["status"]): AbsenceStreakDay => ({
  date,
  status,
});

describe("findAbsenceStreaks", () => {
  it("finds a run of exactly the threshold", () => {
    const streaks = findAbsenceStreaks(
      [day("2026-03-02", "absent"), day("2026-03-03", "absent"), day("2026-03-04", "absent")],
      3,
    );
    expect(streaks).toHaveLength(1);
    expect(streaks[0]).toMatchObject({
      startDate: "2026-03-02",
      endDate: "2026-03-04",
      length: 3,
    });
  });

  it("ignores runs shorter than the threshold", () => {
    expect(
      findAbsenceStreaks([day("2026-03-02", "absent"), day("2026-03-03", "absent")], 3),
    ).toEqual([]);
  });

  it("breaks on present, late and excused", () => {
    expect(
      findAbsenceStreaks(
        [
          day("2026-03-02", "absent"),
          day("2026-03-03", "present"),
          day("2026-03-04", "absent"),
          day("2026-03-05", "absent"),
        ],
        3,
      ),
    ).toEqual([]);
    expect(
      findAbsenceStreaks(
        [
          day("2026-03-02", "absent"),
          day("2026-03-03", "late"),
          day("2026-03-04", "absent"),
          day("2026-03-05", "absent"),
        ],
        3,
      ),
    ).toEqual([]);
    expect(
      findAbsenceStreaks(
        [
          day("2026-03-02", "absent"),
          day("2026-03-03", "excused"),
          day("2026-03-04", "absent"),
          day("2026-03-05", "absent"),
        ],
        3,
      ),
    ).toEqual([]);
  });

  it("breaks on an unmarked day instead of bridging the gap", () => {
    const streaks = findAbsenceStreaks(
      [
        day("2026-03-02", "absent"),
        day("2026-03-03", null),
        day("2026-03-04", "absent"),
        day("2026-03-05", "absent"),
      ],
      3,
    );
    expect(streaks).toEqual([]);
  });

  it("ignores non-countable days", () => {
    const streaks = findAbsenceStreaks(
      [
        day("2026-03-02", "absent"),
        { date: "2026-03-03", status: "absent", countable: false },
        day("2026-03-04", "absent"),
      ],
      2,
    );
    expect(streaks).toEqual([]);
  });

  it("orders unordered input and reports every qualifying run", () => {
    const streaks = findAbsenceStreaks(
      [
        day("2026-03-05", "absent"),
        day("2026-03-02", "absent"),
        day("2026-03-04", "absent"),
        day("2026-03-03", "absent"),
        day("2026-03-06", "present"),
        day("2026-03-07", "absent"),
        day("2026-03-08", "absent"),
      ],
      2,
    );
    expect(streaks.map((streak) => [streak.startDate, streak.length])).toEqual([
      ["2026-03-02", 4],
      ["2026-03-07", 2],
    ]);
  });

  it("treats a sub-1 threshold as 1", () => {
    expect(findAbsenceStreaks([day("2026-03-02", "absent")], 0)).toHaveLength(1);
  });
});

describe("absence streak helpers", () => {
  it("classifies only absent as unexcused", () => {
    expect(isUnexcusedAbsence("absent")).toBe(true);
    expect(isUnexcusedAbsence("excused")).toBe(false);
    expect(isUnexcusedAbsence("late")).toBe(false);
    expect(isUnexcusedAbsence(null)).toBe(false);
  });

  it("builds the alert idempotency key from class, student and streak start", () => {
    expect(
      absenceAlertKey({ classId: "c1", studentId: "s1", startDate: "2026-03-02T00:00:00Z" }),
    ).toBe("c1|s1|2026-03-02");
  });

  it("notifies only for alerts that are still open and unsent", () => {
    expect(shouldNotifyAbsenceAlert("open")).toBe(true);
    expect(shouldNotifyAbsenceAlert(null)).toBe(true);
    expect(shouldNotifyAbsenceAlert("resolved")).toBe(false);
    expect(shouldNotifyAbsenceAlert("dismissed")).toBe(false);
  });
});
