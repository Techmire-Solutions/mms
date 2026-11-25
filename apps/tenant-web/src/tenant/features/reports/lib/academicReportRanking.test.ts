import { describe, expect, it } from "vitest";
import type { Exam, ExamResult } from "@/lib/data/examinationData";
import {
  rankAcademicRows,
  scoreAcademicRows,
  summarizeClassRankings,
  toAcademicResultItems,
} from "./academicReportRanking";

/**
 * The reports leaderboard used to rank on the rounded percentage (2 dp in one surface, integer in
 * the class averages), so near-equal scores shared a rank and averages drifted. These pin the
 * unrounded comparison rules.
 */

function exam(overrides: Partial<Exam> = {}): Exam {
  return {
    id: "ex-1",
    name: "Midterm",
    subject: "Quran",
    totalMarks: 100,
    passingMarks: 50,
    date: "2026-03-10",
    duration: 60,
    classIds: ["cls-1"],
    status: "completed",
    description: "",
    ...overrides,
  } as Exam;
}

function result(overrides: Partial<ExamResult> = {}): ExamResult {
  return {
    id: `r-${Math.random().toString(36).slice(2, 8)}`,
    examId: "ex-1",
    studentId: "s-1",
    marksObtained: 80,
    ...overrides,
  } as ExamResult;
}

const students = [
  { id: "s-1", name: "Aisha" },
  { id: "s-2", name: "Bilal" },
  { id: "s-3", name: "Fatima" },
];

describe("academic report ranking", () => {
  it("does not create a tie from two distinct scores that round to the same display value", () => {
    // 269.97/300 = 89.99 %, 269.98/300 = 89.9933 %: both display as 90, raw values differ.
    const rows = rankAcademicRows(
      scoreAcademicRows(
        [exam({ totalMarks: 300 })],
        [
          result({ studentId: "s-1", marksObtained: 269.98 }),
          result({ studentId: "s-2", marksObtained: 269.97 }),
        ],
        students,
      ),
    );

    const byStudent = new Map(rows.map((row) => [row.studentId, row]));
    expect(byStudent.get("s-1")?.rank).toBe(1);
    expect(byStudent.get("s-2")?.rank).toBe(2);
    expect(byStudent.get("s-1")?.displayPct).toBe(90);
    expect(byStudent.get("s-2")?.displayPct).toBe(90);
  });

  it("still shares a rank for exactly equal scores (competition ranking)", () => {
    const rows = rankAcademicRows(
      scoreAcademicRows(
        [exam()],
        [
          result({ studentId: "s-1", marksObtained: 90 }),
          result({ studentId: "s-2", marksObtained: 90 }),
          result({ studentId: "s-3", marksObtained: 70 }),
        ],
        students,
      ),
    );
    const byStudent = new Map(rows.map((row) => [row.studentId, row]));
    expect(byStudent.get("s-1")?.rank).toBe(1);
    expect(byStudent.get("s-2")?.rank).toBe(1);
    expect(byStudent.get("s-3")?.rank).toBe(3);
  });

  it("includes grace in the score and the ranking", () => {
    const rows = rankAcademicRows(
      scoreAcademicRows(
        [exam()],
        [
          result({ studentId: "s-1", marksObtained: 88 }),
          result({ studentId: "s-2", marksObtained: 86, graceMarks: 3 }),
        ],
        students,
      ),
    );
    const byStudent = new Map(rows.map((row) => [row.studentId, row]));
    expect(byStudent.get("s-2")?.rawPct).toBe(89);
    expect(byStudent.get("s-2")?.rank).toBe(1);
  });

  it("averages raw percentages once instead of averaging rounded integers", () => {
    // 89.5 and 88.5: old integer displays 90 + 89 -> 89.5 -> 90; raw mean is 89.0 -> 89.
    const rankings = summarizeClassRankings(
      scoreAcademicRows(
        [exam()],
        [
          result({ studentId: "s-1", marksObtained: 89.5 }),
          result({ studentId: "s-2", marksObtained: 88.5 }),
        ],
        students,
      ),
    );
    expect(rankings[0]?.averageMarks).toBe(89);
    expect(rankings[0]?.class).toBe("Midterm");
  });

  it("picks the top student by raw score and exposes table rows", () => {
    const rows = rankAcademicRows(
      scoreAcademicRows(
        [exam()],
        [
          result({ studentId: "s-1", marksObtained: 89.4 }),
          result({ studentId: "s-2", marksObtained: 89.6 }),
        ],
        students,
      ),
    );
    expect(summarizeClassRankings(rows)[0]?.topStudent).toBe("Bilal");
    expect(toAcademicResultItems(rows)).toEqual([
      expect.objectContaining({ studentName: "Bilal", marks: 90, rank: 1, total: 100 }),
      expect.objectContaining({ studentName: "Aisha", marks: 89, rank: 2, total: 100 }),
    ]);
  });

  it("skips results whose exam or student is not loaded", () => {
    const rows = scoreAcademicRows(
      [exam()],
      [result({ studentId: "missing" }), result({ examId: "missing", studentId: "s-1" })],
      students,
    );
    expect(rows).toHaveLength(0);
  });
});
