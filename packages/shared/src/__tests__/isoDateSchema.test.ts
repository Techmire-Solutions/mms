import { describe, expect, it } from "vitest";
import {
  compareIsoDates,
  isValidIsoDate,
  isoDateOrEmptySchema,
  isoDateSchema,
} from "../core/isoDateSchema.js";

describe("isoDateSchema", () => {
  it("accepts valid calendar dates in YYYY-MM-DD format", () => {
    expect(isValidIsoDate("2026-01-15")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true); // leap year
    expect(isoDateSchema.safeParse("2026-09-14").success).toBe(true);
  });

  it("rejects invalid or impossible dates", () => {
    expect(isValidIsoDate("2026-02-29")).toBe(false); // not a leap year
    expect(isValidIsoDate("2026-04-31")).toBe(false); // April has 30 days
    expect(isValidIsoDate("2026-13-01")).toBe(false); // invalid month
    expect(isValidIsoDate("2026-00-10")).toBe(false); // month 0
    expect(isValidIsoDate("not-a-date")).toBe(false);
    expect(isoDateSchema.safeParse("2026-02-31").success).toBe(false);
  });

  it("supports isoDateOrEmptySchema with empty strings and valid dates", () => {
    expect(isoDateOrEmptySchema.safeParse("").success).toBe(true);
    expect(isoDateOrEmptySchema.safeParse("2026-05-20").success).toBe(true);
    expect(isoDateOrEmptySchema.safeParse("   ").success).toBe(false);
    expect(isoDateOrEmptySchema.safeParse("2026-02-30").success).toBe(false);
  });

  it("correctly compares ISO dates chronologically", () => {
    expect(compareIsoDates("2026-01-01", "2026-01-02")).toBe(-1);
    expect(compareIsoDates("2026-02-15", "2026-02-15")).toBe(0);
    expect(compareIsoDates("2026-12-31", "2026-05-01")).toBe(1);
  });

  it("rejects wrong shapes, not just impossible dates", () => {
    for (const value of [
      "2026-1-5", // not zero-padded
      "15-01-2026", // day-first
      "2026/01/15", // wrong separator
      "2026-01-15T00:00:00Z", // a timestamp, not a date
      "0000-00-00",
      "",
    ]) {
      expect(isoDateSchema.safeParse(value).success, value).toBe(false);
    }
  });

  it("sorts a mixed list chronologically", () => {
    expect(["2026-03-01", "2025-12-31", "2026-01-15", "2026-01-01"].sort(compareIsoDates)).toEqual([
      "2025-12-31",
      "2026-01-01",
      "2026-01-15",
      "2026-03-01",
    ]);
  });
});
