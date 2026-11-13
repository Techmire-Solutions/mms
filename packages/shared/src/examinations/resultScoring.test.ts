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

  it("passes exactly at the exam's pass mark", () => {
    const exact = resolveResultScore({ marksObtained: 50, totalMarks: 100, passingMarks: 50 });
    expect(exact.passed).toBe(true);
    expect(exact.grade.label).toBe("D");
  });

  it("clamps malformed and out-of-range inputs instead of producing NaN/Infinity", () => {
    const malformed = resolveResultScore({
      marksObtained: Number.NaN,
      totalMarks: Number.POSITIVE_INFINITY,
      passingMarks: -5,
    });
    expect(malformed.effectiveMarks).toBe(0);
    expect(Number.isFinite(malformed.percentage)).toBe(true);
    // A non-finite total is a scoring fault, so the result is a failure (not an Infinity/A+).
    expect(malformed.passed).toBe(false);

    const negative = resolveResultScore({
      marksObtained: -10,
      totalMarks: 100,
      passingMarks: 50,
      graceMarks: -2,
    });
    expect(negative.effectiveMarks).toBe(0);
    expect(negative.passed).toBe(false);

    // Marks above the total are clamped for percentage, but the pass comparison uses the score.
    const over = resolveResultScore({ marksObtained: 120, totalMarks: 100, passingMarks: 50 });
    expect(over.rawPercentage).toBe(100);
    expect(over.displayPercentage).toBe(100);
    expect(over.passed).toBe(true);
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
    // Decimal-text rounding, not binary-double drift: halves and near-halves at the cent boundary.
    expect(roundPercentage(0.005)).toBe(0.01);
    expect(roundPercentage(0.015)).toBe(0.02);
    expect(roundPercentage(66.665)).toBe(66.67);
    expect(roundPercentage(-12.345)).toBe(-12.34);
    expect(Number.isNaN(roundPercentage(Number.NaN))).toBe(true);
    expect(roundPercentage(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
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

  it("handles an empty list and a missing tie-break without inventing order", () => {
    expect(rankResults([], { score: () => 0 })).toEqual([]);
    const tied = rankResults(
      [
        { id: "b", marks: 70 },
        { id: "a", marks: 70 },
      ],
      { score: (row) => row.marks },
    );
    // No tie-break: stable input order, shared rank.
    expect(tied.map((row) => [row.id, row.rank])).toEqual([
      ["b", 1],
      ["a", 1],
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

  it("shares ranks for ties inside a class and overall (competition ranking)", () => {
    const rows = [
      { id: "a", marks: 90, classId: "c1" },
      { id: "b", marks: 90, classId: "c1" },
      { id: "c", marks: 90, classId: "c2" },
      { id: "d", marks: 80, classId: "c2" },
    ];
    const ranked = rankInExam(rows, {
      score: (row) => row.marks,
      classId: (row) => row.classId,
      tieBreak: (row) => row.id,
    });
    const byId = new Map(ranked.map((row) => [row.id, row]));
    expect(byId.get("a")).toMatchObject({ rank: 1, classRank: 1, classSize: 2 });
    expect(byId.get("b")).toMatchObject({ rank: 1, classRank: 1, classSize: 2 });
    expect(byId.get("c")).toMatchObject({ rank: 1, classRank: 1, classSize: 2 });
    expect(byId.get("d")).toMatchObject({ rank: 4, classRank: 2, classSize: 2 });
  });

  it("groups a null/unknown class under one bucket and handles an empty exam", () => {
    const rows = [
      { id: "a", marks: 70, classId: null },
      { id: "b", marks: 60, classId: undefined },
    ];
    const ranked = rankInExam(rows, {
      score: (row) => row.marks,
      classId: (row) => row.classId,
      tieBreak: (row) => row.id,
    });
    expect(ranked.map((row) => [row.id, row.classRank, row.classSize])).toEqual([
      ["a", 1, 2],
      ["b", 2, 2],
    ]);
    expect(rankInExam([], { score: () => 0, classId: () => null })).toEqual([]);
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
