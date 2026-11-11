import { describe, expect, it } from "vitest";
import {
  ordinalPosition,
  rankInExam,
  rankResults,
  resolveResultScore,
  roundPercentage,
} from "./resultScoring.js";
import { GRADE_BANDS, getGrade, getRankSuffix } from "./gradeUtils.js";

describe("resolveResultScore", () => {
  it("grades and fails from the raw score, so the two can never disagree", () => {
    // 49.6% with a 50 pass mark: previously displayed as grade "D" while `passed` was false.
    const failed = resolveResultScore({ marksObtained: 49.6, totalMarks: 100, passingMarks: 50 });
    expect(failed.passed).toBe(false);
    expect(failed.grade.label).toBe("F");
    expect(failed.displayPercentage).toBe(50); // display rounding is display-only
    expect(failed.percentage).toBe(49.6);

    // 89.5% is an A, not an A+ (the old code rounded to 90 before grading).
    const a = resolveResultScore({ marksObtained: 89.5, totalMarks: 100, passingMarks: 50 });
    expect(a.grade.label).toBe("A");
    expect(a.passed).toBe(true);
  });

  it("uses the exam's pass mark, not a hardcoded 50", () => {
    expect(
      resolveResultScore({ marksObtained: 45, totalMarks: 100, passingMarks: 40 }).passed,
    ).toBe(true);
    const stretched = resolveResultScore({ marksObtained: 55, totalMarks: 100, passingMarks: 60 });
    expect(stretched.passed).toBe(false);
    expect(stretched.grade.label).toBe("F");
  });

  it("adds grace marks to the effective score without touching the raw mark", () => {
    const score = resolveResultScore({
      marksObtained: 48,
      totalMarks: 100,
      passingMarks: 50,
      graceMarks: 2,
    });
    expect(score.effectiveMarks).toBe(50);
    expect(score.passed).toBe(true);
    expect(score.rawPercentage).toBe(50);
  });

  it("never divides by zero or returns Infinity/A+", () => {
    const broken = resolveResultScore({ marksObtained: 90, totalMarks: 0, passingMarks: 50 });
    expect(broken.percentage).toBe(0);
    expect(broken.grade.label).toBe("F");
    expect(broken.passed).toBe(false);
  });

  it("rounds percentages to two decimals only for display", () => {
    const score = resolveResultScore({
      marksObtained: 2,
      totalMarks: 3,
      passingMarks: 1,
    });
    expect(score.rawPercentage).toBeCloseTo(66.6666, 3);
    expect(score.percentage).toBe(66.67);
    expect(score.displayPercentage).toBe(67);
    expect(roundPercentage(33.3333)).toBe(33.33);
  });
});

describe("rankResults", () => {
  const students = [
    { id: "c", marks: 80 },
    { id: "a", marks: 90 },
    { id: "b", marks: 90 },
    { id: "d", marks: 70 },
  ];

  it("shares the rank for equal scores and skips (1, 1, 3)", () => {
    const ranked = rankResults(students, {
      score: (student) => student.marks,
      tieBreak: (student) => student.id,
    });
    expect(ranked.map((row) => [row.id, row.rank, row.position])).toEqual([
      ["a", 1, 1],
      ["b", 1, 2],
      ["c", 3, 3],
      ["d", 4, 4],
    ]);
  });

  it("is deterministic for ties", () => {
    const first = rankResults(students, {
      score: (student) => student.marks,
      tieBreak: (student) => student.id,
    });
    const second = rankResults([...students].reverse(), {
      score: (student) => student.marks,
      tieBreak: (student) => student.id,
    });
    expect(second.map((row) => row.id)).toEqual(first.map((row) => row.id));
  });
});

describe("rankInExam", () => {
  it("ranks overall and per class independently", () => {
    const rows = [
      { id: "s1", marks: 90, classId: "c1" },
      { id: "s2", marks: 80, classId: "c1" },
      { id: "s3", marks: 85, classId: "c2" },
    ];
    const ranked = rankInExam(rows, {
      score: (row) => row.marks,
      classId: (row) => row.classId,
      tieBreak: (row) => row.id,
    });

    const byId = new Map(ranked.map((row) => [row.id, row]));
    expect(byId.get("s1")).toMatchObject({ rank: 1, classRank: 1, classSize: 2, overallSize: 3 });
    expect(byId.get("s2")).toMatchObject({ rank: 3, classRank: 2, classSize: 2 });
    expect(byId.get("s3")).toMatchObject({ rank: 2, classRank: 1, classSize: 1 });
  });
});

describe("grade bands (boundary sweep)", () => {
  const cases: Array<[number, string]> = [
    [100, "A+"],
    [90, "A+"],
    [89.99, "A"],
    [80, "A"],
    [79.99, "B"],
    [70, "B"],
    [69.99, "C"],
    [60, "C"],
    [59.99, "D"],
    [50, "D"],
    [49.99, "F"],
    [0, "F"],
  ];

  it.each(cases)("maps %s%% to %s", (pct, label) => {
    expect(getGrade(pct).label).toBe(label);
  });

  it("is ordered high to low and ends at a 0 floor", () => {
    expect(GRADE_BANDS.map((band) => band.minPct)).toEqual([90, 80, 70, 60, 50, 0]);
  });

  it("floors a failed score to F even when its percentage would earn a higher letter", () => {
    const failed = resolveResultScore({ marksObtained: 60, totalMarks: 100, passingMarks: 70 });
    expect(failed.passed).toBe(false);
    expect(failed.grade.label).toBe("F");
  });

  it("turns a fail into a pass only through grace marks", () => {
    const raw = resolveResultScore({ marksObtained: 48, totalMarks: 100, passingMarks: 50 });
    const graced = resolveResultScore({
      marksObtained: 48,
      totalMarks: 100,
      passingMarks: 50,
      graceMarks: 2,
    });
    expect(raw.passed).toBe(false);
    expect(graced.passed).toBe(true);
  });

  it("rounds only for display and keeps the raw value for grading", () => {
    const score = resolveResultScore({ marksObtained: 89.5, totalMarks: 100, passingMarks: 50 });
    expect(score.percentage).toBe(89.5);
    expect(score.grade.label).toBe("A");
    expect(score.displayPercentage).toBe(90);
  });
});

describe("ordinal labels", () => {
  const cases: Array<[number, string]> = [
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [101, "101st"],
    [111, "111th"],
    [112, "112th"],
    [113, "113th"],
  ];

  it.each(cases)("formats %s as %s through both helpers", (n, label) => {
    expect(ordinalPosition(n)).toBe(label);
    expect(getRankSuffix(n)).toBe(label);
  });
});
