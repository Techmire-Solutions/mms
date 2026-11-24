import { describe, it, expect } from "vitest";
import { hijriDayOfMonth, hijriMonthYearLabel, hijriMonthSpanLabel } from "./hijriCalendar.js";

describe("hijriDayOfMonth", () => {
  it("returns a day within the Hijri month range", () => {
    const day = hijriDayOfMonth("2026-10-21");
    expect(day).not.toBeNull();
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(30);
  });

  it("advances by one when the Gregorian date advances by one", () => {
    const first = hijriDayOfMonth("2026-10-21");
    const second = hijriDayOfMonth("2026-10-22");
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    // Either the next day in the same month, or day 1 of the next Hijri month.
    expect(second === (first as number) + 1 || second === 1).toBe(true);
  });

  it("rejects malformed and empty input", () => {
    expect(hijriDayOfMonth("")).toBeNull();
    expect(hijriDayOfMonth("21-10-2026")).toBeNull();
    expect(hijriDayOfMonth("2026-13-45")).toBeNull();
  });
});

describe("hijriMonthYearLabel", () => {
  it("includes a four-digit Hijri year", () => {
    expect(hijriMonthYearLabel("2026-10-21")).toMatch(/1\d{3}/);
  });

  it("returns an empty string for unusable input", () => {
    expect(hijriMonthYearLabel("not-a-date")).toBe("");
  });
});

describe("hijriMonthSpanLabel", () => {
  it("collapses to one label when both ends share a Hijri month", () => {
    const single = hijriMonthSpanLabel("2026-10-21", "2026-10-21");
    expect(single).toBe(hijriMonthYearLabel("2026-10-21"));
    expect(single).not.toContain("–");
  });

  it("shows both ends when a Gregorian month straddles two Hijri months", () => {
    expect(hijriMonthSpanLabel("2026-10-01", "2026-10-31")).toContain("–");
  });

  it("returns an empty string when either end is unusable", () => {
    expect(hijriMonthSpanLabel("2026-10-01", "nope")).toBe("");
    expect(hijriMonthSpanLabel("nope", "2026-10-31")).toBe("");
  });
});
