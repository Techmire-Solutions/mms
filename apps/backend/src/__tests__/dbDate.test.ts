import { describe, expect, it } from "vitest";
import { requireDbDate, requireDbDateValue } from "../lib/dbDate.js";
import { ValidationError } from "../lib/httpErrors.js";

describe("dbDate write guards", () => {
  it("given an empty value, should map nullable columns to NULL", () => {
    expect(requireDbDate("", "paid_date")).toBeNull();
    expect(requireDbDate("   ", "paid_date")).toBeNull();
    expect(requireDbDate(null, "paid_date")).toBeNull();
  });

  it("given a date or date-time, should keep the calendar day", () => {
    expect(requireDbDateValue("2026-03-02", "date")).toBe("2026-03-02");
    expect(requireDbDateValue(" 2026-03-02T10:00:00Z ", "date")).toBe("2026-03-02");
  });

  it("given an empty value for a NOT NULL column, should reject it", () => {
    expect(() => requireDbDateValue("", "due_date")).toThrow(ValidationError);
    expect(() => requireDbDateValue(undefined, "due_date")).toThrow("due_date is required");
  });

  it("given an impossible or non-ISO date, should reject it", () => {
    expect(() => requireDbDateValue("2026-02-31", "date")).toThrow(ValidationError);
    expect(() => requireDbDateValue("01/03/2026", "date")).toThrow(
      "date must be a date (YYYY-MM-DD)",
    );
  });
});
