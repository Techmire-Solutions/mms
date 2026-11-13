import { getGrade, getRankSuffix, type GradeInfo } from "./gradeUtils.js";

/**
 * Single source of truth for examination scoring: percentage, letter grade, pass/fail and rank.
 *
 * Before this existed the same result was scored four different ways (results grid, reports
 * controller, report card, certificate) with two rounding policies, so a student could be `A+` on
 * screen and `A` on the printed card, or `passed` while showing an `F` grade. Every surface now
 * calls these functions; nothing else may divide marks by total marks.
 *
 * Rules:
 * - percentages are computed from **raw (effective) marks**, never from a rounded percentage;
 * - `passed` and `grade` come from the same comparison, so they can never disagree;
 * - a zero/negative total is a scoring fault, not an `Infinity` (which used to render as `A+`).
 */

export interface ResultScoreInput {
  marksObtained: number;
  totalMarks: number;
  /** The exam's pass mark — not a module default. */
  passingMarks: number;
  /** Moderation adjustment; added to `marksObtained` for the effective score. */
  graceMarks?: number | null;
}

export interface ResultScore {
  /** `marksObtained + graceMarks` — what the student actually earned after moderation. */
  effectiveMarks: number;
  /** Unrounded percentage, for comparisons and ranking. */
  rawPercentage: number;
  /** Percentage rounded to 2 decimals — for tables and storage. */
  percentage: number;
  /** Integer percentage — for compact badges/labels. */
  displayPercentage: number;
  grade: GradeInfo;
  passed: boolean;
}

function finiteOrZero(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

/** Rounds to 2 decimals using the decimal text (avoids `x.005` binary-representation drift). */
export function roundPercentage(value: number): number {
  const shifted = Number(`${value}e2`);
  const scaled = Number.isFinite(shifted) ? Math.round(shifted) : Math.round(value * 100);
  return scaled / 100;
}

export function resolveResultScore(input: ResultScoreInput): ResultScore {
  const totalMarks = finiteOrZero(input.totalMarks);
  const marks = Math.max(0, finiteOrZero(input.marksObtained));
  const grace = Math.max(0, finiteOrZero(input.graceMarks));
  const effectiveMarks = marks + grace;
  const passingMarks = finiteOrZero(input.passingMarks);

  if (totalMarks <= 0) {
    // A data fault (legacy row not covered by the 0236 CHECK): score it as a failure, never NaN/∞.
    return {
      effectiveMarks,
      rawPercentage: 0,
      percentage: 0,
      displayPercentage: 0,
      grade: getGrade(0),
      passed: false,
    };
  }

  const rawPercentage = Math.min(100, Math.max(0, (effectiveMarks / totalMarks) * 100));
  const passed = effectiveMarks >= passingMarks;

  return {
    effectiveMarks,
    rawPercentage,
    percentage: roundPercentage(rawPercentage),
    displayPercentage: Math.round(rawPercentage),
    // Grade floor: a fail is an F regardless of where the letter table would place the percentage.
    grade: passed ? getGrade(rawPercentage) : getGrade(0),
    passed,
  };
}

/** Result of competition ranking: equal scores share a rank, the next rank skips (1, 1, 3). */
export interface RankedPosition {
  rank: number;
  position: number;
}

export interface RankOptions<T> {
  /** Higher is better (marks or percentage — both are monotonic within one exam). */
  score: (item: T) => number;
  /** Deterministic order for equal scores. */
  tieBreak?: (item: T) => string;
}

function sortForRanking<T>(items: readonly T[], options: RankOptions<T>): T[] {
  return [...items].sort((a, b) => {
    const delta = options.score(b) - options.score(a);
    if (delta !== 0) return delta;
    const tieA = options.tieBreak?.(a) ?? "";
    const tieB = options.tieBreak?.(b) ?? "";
    return tieA.localeCompare(tieB);
  });
}

/**
 * Competition ranking over one list.
 *
 * Ties share the better rank (`1, 1, 3`); `position` is always the ordinal slot, so a UI can show
 * `=1st` versus `2nd` distinctly. The tie-break string makes the order reproducible across renders.
 */
export function rankResults<T>(
  items: readonly T[],
  options: RankOptions<T>,
): Array<T & RankedPosition> {
  const sorted = sortForRanking(items, options);
  let previousScore: number | null = null;
  let previousRank = 0;
  return sorted.map((item, index) => {
    const score = options.score(item);
    const rank = score === previousScore ? previousRank : index + 1;
    previousScore = score;
    previousRank = rank;
    return { ...item, rank, position: index + 1 };
  });
}

export interface RankInExamOptions<T> extends RankOptions<T> {
  /** Exam class id (or any grouping key). */
  classId: (item: T) => string | null | undefined;
}

export interface RankedInExam extends RankedPosition {
  /** Rank across every participant of the exam. */
  classRank: number;
  classPosition: number;
  classSize: number;
  overallSize: number;
}

/**
 * Overall + per-class positions for one exam.
 *
 * "Class rank" was previously the exam-wide rank: an exam spanning two classes ranked them together
 * and printed that as a class position. Participants are grouped by `classId` for the class rank
 * while the overall rank is still available (e.g. for a merit list).
 */
export function rankInExam<T>(
  items: readonly T[],
  options: RankInExamOptions<T>,
): Array<T & RankedInExam> {
  const overall = rankResults(items, options);
  const byPosition = new Map<number, RankedPosition & { classSize: number; classKey: string }>();

  const groups = new Map<string, Array<T & RankedPosition>>();
  for (const item of overall) {
    const key = options.classId(item) ?? "";
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  for (const bucket of groups.values()) {
    let previousScore: number | null = null;
    let previousRank = 0;
    // `row.position` is the row's *overall* slot (unique across the exam), so it is a safe key
    // while `index + 1` is the within-class position.
    bucket.forEach((row, index) => {
      const score = options.score(row);
      const rank = score === previousScore ? previousRank : index + 1;
      previousScore = score;
      previousRank = rank;
      byPosition.set(row.position, {
        rank,
        position: index + 1,
        classSize: bucket.length,
        classKey: options.classId(row) ?? "",
      });
    });
  }

  return overall.map((item) => {
    const classRank = byPosition.get(item.position) ?? {
      rank: item.rank,
      position: item.position,
      classSize: overall.length,
      classKey: "",
    };
    return {
      ...item,
      classRank: classRank.rank,
      classPosition: classRank.position,
      classSize: classRank.classSize,
      overallSize: overall.length,
    };
  });
}

/** `1st`, `2nd`, `3rd`, `4th` … — one implementation, shared with the printed labels. */
export function ordinalPosition(position: number): string {
  return getRankSuffix(position);
}
