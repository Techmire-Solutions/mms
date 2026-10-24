import { describe, expect, it } from "vitest";
import { getGrade, getRankSuffix } from "../lib/gradeUtils";

describe("gradeUtils", () => {
  it("computes grade information from percentage", () => {
    const gradeA = getGrade(95);
    expect(gradeA.label).toBe("A+");

    const gradeF = getGrade(30);
    expect(gradeF.label).toBe("F");
  });

  it("computes ordinal suffix for ranks", () => {
    expect(getRankSuffix(1)).toBe("1st");
    expect(getRankSuffix(2)).toBe("2nd");
    expect(getRankSuffix(3)).toBe("3rd");
    expect(getRankSuffix(4)).toBe("4th");
    expect(getRankSuffix(21)).toBe("21st");
  });
});
