import { describe, expect, it } from "vitest";
import {
  ageOnDate,
  evaluateEligibility,
  remainingSeats,
  type EligibilityInput,
} from "./enrollmentEligibility.js";

function input(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    applicant: { dateOfBirth: "2018-06-15", gender: "male" },
    cls: {
      gender: "male",
      minAge: 6,
      maxAge: 10,
      ageCalculationDate: "2026-04-01",
      sections: [{ capacity: 2, enrolled: 1 }],
    },
    session: { status: "open", startDate: "2026-04-01" },
    asOf: "2026-03-01",
    ...overrides,
  };
}

describe("ageOnDate", () => {
  it("given birthdays before and after the day, should count completed years", () => {
    // Assert
    expect(ageOnDate("2018-06-15", "2026-06-14")).toBe(7);
    expect(ageOnDate("2018-06-15", "2026-06-15")).toBe(8);
    expect(ageOnDate("2030-01-01", "2026-01-01")).toBeNull();
    expect(ageOnDate("junk", "2026-01-01")).toBeNull();
  });
});

describe("evaluateEligibility", () => {
  it("given a matching applicant with seats left, should be eligible without waitlist", () => {
    // Act
    const result = evaluateEligibility(input());

    // Assert
    expect(result).toEqual({
      eligible: true,
      waitlist: false,
      reasons: [],
      ageOnDate: 7,
      seatsLeft: 1,
    });
  });

  it("given age measured on the class day, wrong gender and a draft session, should list every reason", () => {
    // Act
    const result = evaluateEligibility(
      input({
        applicant: { dateOfBirth: "2021-01-01", gender: "f" },
        session: { status: "draft", startDate: "2026-04-01" },
      }),
    );

    // Assert
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(["session_not_open", "age_below", "gender_mismatch"]);
  });

  it("given a full class or a closed window, should waitlist or reject", () => {
    // Act
    const full = evaluateEligibility(
      input({
        cls: {
          gender: "mixed",
          sections: [
            { capacity: 1, enrolled: 1 },
            { capacity: 5, enrolled: 0, status: "closed" },
          ],
        },
      }),
    );
    const closed = evaluateEligibility(
      input({ window: { closesAt: "2026-02-01T00:00:00Z", now: "2026-03-01T00:00:00Z" } }),
    );
    const missingDob = evaluateEligibility(input({ applicant: { gender: "male" } }));

    // Assert
    expect(full).toMatchObject({ eligible: true, waitlist: true, seatsLeft: 0 });
    expect(closed.reasons).toEqual(["window_closed"]);
    expect(missingDob.reasons).toEqual(["dob_missing"]);
  });

  it("given no sections and no cap, should treat seats as unlimited", () => {
    // Assert
    expect(remainingSeats({ maxStudents: 0, enrolled: 50 })).toBeNull();
    expect(remainingSeats({ maxStudents: 30, enrolled: 31 })).toBe(0);
  });
});
