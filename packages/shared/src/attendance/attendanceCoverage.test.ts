import { describe, expect, it } from "vitest";
import { unmarkedInstructionalDays } from "./attendanceCoverage.js";

describe("unmarkedInstructionalDays", () => {
  it("returns the teaching days with no attendance row", () => {
    expect(
      unmarkedInstructionalDays(["2026-03-02", "2026-03-03", "2026-03-04"], ["2026-03-03"]),
    ).toEqual(["2026-03-02", "2026-03-04"]);
  });

  it("returns nothing when every teaching day is marked", () => {
    expect(unmarkedInstructionalDays(["2026-03-02"], ["2026-03-02"])).toEqual([]);
  });

  it("returns every day when nothing is marked", () => {
    const days = ["2026-03-02", "2026-03-03"];
    expect(unmarkedInstructionalDays(days, [])).toEqual(days);
  });

  it("ignores marked days that are not teaching days", () => {
    expect(unmarkedInstructionalDays(["2026-03-02"], ["2026-03-01", "2026-03-08"])).toEqual([
      "2026-03-02",
    ]);
  });

  it("sorts the result ascending even when the input is not ordered", () => {
    expect(unmarkedInstructionalDays(["2026-03-04", "2026-03-02"], [])).toEqual([
      "2026-03-02",
      "2026-03-04",
    ]);
  });

  it("returns an empty list when there are no teaching days", () => {
    expect(unmarkedInstructionalDays([], ["2026-03-02"])).toEqual([]);
  });
});
