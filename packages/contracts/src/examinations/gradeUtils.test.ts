import { describe, expect, it } from "vitest";
import { GRADE_BANDS, GRADE_LABELS, getGrade, getRankSuffix } from "./gradeUtils.js";

describe("grade label registry", () => {
  it("exports the same labels the bands use, highest first", () => {
    expect(GRADE_LABELS).toEqual(["A+", "A", "B", "C", "D", "F"]);
    expect(GRADE_BANDS.map((band) => band.label)).toEqual([...GRADE_LABELS]);
    expect(GRADE_BANDS.map((band) => band.minPct)).toEqual([90, 80, 70, 60, 50, 0]);
  });

  it("floors NaN and negative percentages to F and tops out at A+", () => {
    expect(getGrade(Number.NaN).label).toBe("F");
    expect(getGrade(-1).label).toBe("F");
    expect(getGrade(0).label).toBe("F");
    expect(getGrade(150).label).toBe("A+");
  });

  it("keeps ordinal suffixes correct for the teens", () => {
    expect(getRankSuffix(11)).toBe("11th");
    expect(getRankSuffix(12)).toBe("12th");
    expect(getRankSuffix(13)).toBe("13th");
    expect(getRankSuffix(21)).toBe("21st");
  });
});
