import { describe, expect, it } from "vitest";
import { dayBeforeIsoDate } from "../sessions/sessionSectionTypes.js";

describe("dayBeforeIsoDate", () => {
  it("returns the previous calendar day within a month", () => {
    expect(dayBeforeIsoDate("2026-01-02")).toBe("2026-01-01");
  });

  it("rolls back across a month boundary", () => {
    expect(dayBeforeIsoDate("2026-03-01")).toBe("2026-02-28");
  });

  it("rolls back across a leap-year February", () => {
    expect(dayBeforeIsoDate("2024-03-01")).toBe("2024-02-29");
  });

  it("rolls back across a year boundary", () => {
    expect(dayBeforeIsoDate("2026-01-01")).toBe("2025-12-31");
  });
});
