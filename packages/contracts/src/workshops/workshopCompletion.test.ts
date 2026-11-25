import { describe, expect, it } from "vitest";
import { evaluateWorkshopCompletion } from "./workshopCompletion.js";

const noCriteria = { minAttendancePct: null, minScorePct: null };
const facts = (presentDays: number, countableDays = 4, scoreTotal = 0, scoreMax = 0) => ({
  countableDays,
  presentDays,
  scoreTotal,
  scoreMax,
});

describe("evaluateWorkshopCompletion", () => {
  it("given no criteria and one day attended, should complete", () => {
    expect(evaluateWorkshopCompletion(facts(1), noCriteria)).toMatchObject({
      status: "completed",
      shortfalls: [],
      attendancePct: 25,
    });
  });

  it("given no criteria and no attendance, should stay registered", () => {
    expect(evaluateWorkshopCompletion(facts(0), noCriteria)).toMatchObject({
      status: "registered",
      shortfalls: ["attendance_none"],
    });
  });

  it("given attendance below the minimum, should be attended but not completed", () => {
    const result = evaluateWorkshopCompletion(facts(2), {
      minAttendancePct: 75,
      minScorePct: null,
    });
    expect(result).toMatchObject({
      status: "attended",
      shortfalls: ["attendance_below"],
      attendancePct: 50,
    });
  });

  it("given a workshop that has not started, should report attendance as unknown", () => {
    const result = evaluateWorkshopCompletion(facts(0, 0), {
      minAttendancePct: 75,
      minScorePct: null,
    });
    expect(result.shortfalls).toEqual(["attendance_none", "attendance_unknown"]);
    expect(result.attendancePct).toBeNull();
  });

  it("given a score minimum, should require score lines and the minimum", () => {
    const criteria = { minAttendancePct: null, minScorePct: 60 };
    expect(evaluateWorkshopCompletion(facts(4), criteria).shortfalls).toEqual(["score_missing"]);
    expect(evaluateWorkshopCompletion(facts(4, 4, 11, 20), criteria)).toMatchObject({
      status: "attended",
      shortfalls: ["score_below"],
      scorePct: 55,
    });
    expect(evaluateWorkshopCompletion(facts(4, 4, 12, 20), criteria).status).toBe("completed");
  });

  it("given the exact minimum, should pass (minimums are inclusive)", () => {
    expect(
      evaluateWorkshopCompletion(facts(3), { minAttendancePct: 75, minScorePct: null }).status,
    ).toBe("completed");
  });
});

describe("evaluateWorkshopCompletion correctness boundaries", () => {
  it("never completes a participant when there is no countable day (dateless / not started)", () => {
    expect(evaluateWorkshopCompletion(facts(1, 0), noCriteria)).toMatchObject({
      status: "attended",
      shortfalls: ["attendance_unknown"],
      attendancePct: null,
    });
  });

  it("compares the unrounded ratio, so 59.96% does not pass a 60% minimum", () => {
    const criteria = { minAttendancePct: 60, minScorePct: null };
    expect(evaluateWorkshopCompletion(facts(5996, 10000), criteria).status).toBe("attended");
    expect(evaluateWorkshopCompletion(facts(6000, 10000), criteria).status).toBe("completed");
  });

  it("treats an explicit 0% minimum as a criterion that always passes", () => {
    expect(
      evaluateWorkshopCompletion(facts(1), { minAttendancePct: 0, minScorePct: 0 }).status,
    ).toBe("completed");
  });

  it("reports >100% only when the numerator is genuinely larger (data bug surfaced, not hidden)", () => {
    const result = evaluateWorkshopCompletion(facts(5, 2), noCriteria);
    expect(result.attendancePct).toBe(250);
    expect(result.status).toBe("completed");
  });
});
