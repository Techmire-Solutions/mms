import { describe, expect, it } from "vitest";
import { isIsoDateOnly, nextIsoDay, workspaceDayStartUtc } from "../lib/workspaceDayBounds.js";

describe("workspaceDayBounds", () => {
  it("computes UTC midnight for the UTC timezone", () => {
    expect(workspaceDayStartUtc("2026-10-01", "UTC").toISOString()).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });

  it("computes the UTC instant of Karachi local midnight (UTC+5)", () => {
    expect(workspaceDayStartUtc("2026-10-01", "Asia/Karachi").toISOString()).toBe(
      "2026-09-30T19:00:00.000Z",
    );
  });

  it("returns the following ISO day", () => {
    expect(nextIsoDay("2026-10-01")).toBe("2026-10-02");
    expect(nextIsoDay("2026-12-31")).toBe("2027-01-01");
  });

  it("recognises date-only strings", () => {
    expect(isIsoDateOnly("2026-10-01")).toBe(true);
    expect(isIsoDateOnly("2026-10-01T10:00:00.000Z")).toBe(false);
  });
});
