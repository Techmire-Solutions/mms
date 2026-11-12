import { describe, expect, it } from "vitest";
import { countWorkshopDays, listWorkshopDays, WORKSHOP_MAX_DAYS } from "./workshopDays.js";

describe("listWorkshopDays", () => {
  it("given a start and end, should list every day inclusive", () => {
    expect(listWorkshopDays("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("given no end, should treat the workshop as one day", () => {
    expect(listWorkshopDays("2026-03-01", null)).toEqual(["2026-03-01"]);
  });

  it("given no start, an end before the start or junk, should list nothing", () => {
    expect(listWorkshopDays(null, "2026-03-01")).toEqual([]);
    expect(listWorkshopDays("2026-03-05", "2026-03-01")).toEqual([]);
    expect(listWorkshopDays("not-a-date", null)).toEqual([]);
  });

  it("given a leap year, should include 29 February", () => {
    expect(listWorkshopDays("2028-02-28", "2028-03-01")).toContain("2028-02-29");
  });

  it("given a very long range, should cap the list", () => {
    expect(listWorkshopDays("2026-01-01", "2027-01-01")).toHaveLength(WORKSHOP_MAX_DAYS);
  });
});

describe("countWorkshopDays", () => {
  it("counts inclusively and treats a missing end as one day", () => {
    expect(countWorkshopDays("2026-02-27", "2026-03-02")).toBe(4);
    expect(countWorkshopDays("2026-03-01", null)).toBe(1);
  });

  it("caps at the business day without capping the span itself", () => {
    expect(countWorkshopDays("2026-03-01", "2026-03-10", "2026-03-05")).toBe(5);
    expect(countWorkshopDays("2026-01-01", "2027-01-01")).toBeGreaterThan(WORKSHOP_MAX_DAYS);
  });

  it("returns 0 for no start, junk, an inverted range or a business day before the start", () => {
    expect(countWorkshopDays(null, "2026-03-01")).toBe(0);
    expect(countWorkshopDays("not-a-date", null)).toBe(0);
    expect(countWorkshopDays("2026-03-05", "2026-03-01")).toBe(0);
    expect(countWorkshopDays("2026-03-05", "2026-03-06", "2026-03-01")).toBe(0);
  });
});
