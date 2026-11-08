import { describe, expect, it } from "vitest";
import {
  addDeadlineError,
  describeEligibilityReasons,
  dropDeadlineError,
  staffEligibilityReasons,
} from "./enrollmentRules.js";

describe("addDeadlineError", () => {
  it("allows the deadline day and rejects the day after", () => {
    expect(addDeadlineError("2026-04-15", "2026-04-15")).toBeNull();
    expect(addDeadlineError("2026-04-15", "2026-04-16")).toMatch(/closed on 2026-04-15/);
  });

  it("treats empty/invalid deadlines as no limit", () => {
    expect(addDeadlineError("", "2030-01-01")).toBeNull();
    expect(addDeadlineError(null, "2030-01-01")).toBeNull();
    expect(addDeadlineError("not-a-date", "2030-01-01")).toBeNull();
  });
});

describe("dropDeadlineError", () => {
  it("allows the deadline day and rejects a later effective date", () => {
    expect(dropDeadlineError("2026-05-01", "2026-05-01")).toBeNull();
    expect(dropDeadlineError("2026-05-01", "2026-05-02")).toMatch(/was 2026-05-01/);
    expect(dropDeadlineError(undefined, "2026-05-02")).toBeNull();
  });
});

describe("staffEligibilityReasons", () => {
  const session = { status: "in_progress", startDate: "2026-01-01" };

  it("reports a wrong-age or wrong-gender student", () => {
    const tooOld = staffEligibilityReasons({
      student: { dob: "2000-01-01", gender: "male" },
      cls: { minAge: 5, maxAge: 12, ageCalculationDate: "2026-01-01" },
      session,
      asOf: "2026-01-01",
    });
    expect(tooOld).toContain("age_above");

    const wrongGender = staffEligibilityReasons({
      student: { dob: "2018-01-01", gender: "female" },
      cls: { gender: "male", minAge: 5, maxAge: 12, ageCalculationDate: "2026-01-01" },
      session,
      asOf: "2026-01-01",
    });
    expect(wrongGender).toContain("gender_mismatch");
  });

  it("does not block on a missing date of birth but keeps the reason vocabulary stable", () => {
    expect(
      staffEligibilityReasons({
        student: { dob: null, gender: "male" },
        cls: { minAge: 5, maxAge: 12 },
        session,
        asOf: "2026-01-01",
      }),
    ).toEqual([]);
  });

  it("leaves session state to the caller (staff may prepare a draft roster)", () => {
    const reasons = staffEligibilityReasons({
      student: { dob: "2018-01-01", gender: "male" },
      cls: { minAge: 5, maxAge: 12 },
      session: { status: "completed", startDate: "2026-01-01" },
      asOf: "2026-01-01",
    });
    expect(reasons).not.toContain("session_not_open");
    expect(describeEligibilityReasons(reasons)).not.toMatch(/session/);
  });
});
