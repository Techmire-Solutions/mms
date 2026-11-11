import { rankResults, resolveResultScore } from "@mms/shared";
import type { Exam, ExamResult } from "@/lib/data/examinationData";
import type {
  AcademicResultItem,
  ClassRankingItem,
} from "@/components/reports/academicReportTypes";

/**
 * Academic-report scoring and ranking, extracted from the React hook so the rules are testable and
 * cannot drift from the scoring engine.
 *
 * Every comparison (rank, class average, top student) uses the **unrounded** raw percentage.
 * Ranking on `score.percentage` (2 dp) or `displayPercentage` (integer) collapsed distinct scores
 * into artificial ties — a 89.996 % and a 89.999 % student both read as 90 % and shared a rank.
 */

export interface AcademicScoredRow {
  examId: string;
  studentId: string;
  studentName: string;
  /** Exam name, used as the report's class grouping (the existing report vocabulary). */
  classLabel: string;
  subject: string;
  /** Integer percentage for display. */
  displayPct: number;
  /** Unrounded percentage — the only value used for comparisons. */
  rawPct: number;
  grade: string;
  passed: boolean;
}

export interface AcademicRankedRow extends AcademicScoredRow {
  rank: number;
}

type StudentLike = { id?: string | number; name?: string };

/** One row per (student, exam), scored by the shared engine against the exam's own pass mark. */
export function scoreAcademicRows(
  exams: readonly Exam[],
  examResults: readonly ExamResult[],
  students: readonly StudentLike[],
): AcademicScoredRow[] {
  const examsById = new Map(exams.map((exam) => [exam.id, exam]));
  const studentsById = new Map(students.map((student) => [String(student.id), student]));

  return examResults.flatMap((examResult) => {
    const exam = examsById.get(examResult.examId);
    const student = studentsById.get(String(examResult.studentId));
    if (!exam || !student) return [];
    const score = resolveResultScore({
      marksObtained: examResult.marksObtained,
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks,
      graceMarks: examResult.graceMarks,
    });
    return [
      {
        examId: exam.id,
        studentId: String(examResult.studentId),
        studentName: student.name || "",
        classLabel: exam.name,
        subject: exam.subject,
        displayPct: score.displayPercentage,
        rawPct: score.rawPercentage,
        grade: score.grade.label,
        passed: score.passed,
      },
    ];
  });
}

/** Competition ranking per exam on the raw percentage; deterministic tie-break. */
export function rankAcademicRows(rows: readonly AcademicScoredRow[]): AcademicRankedRow[] {
  const byExam = new Map<string, AcademicScoredRow[]>();
  for (const row of rows) {
    const bucket = byExam.get(row.examId) ?? [];
    bucket.push(row);
    byExam.set(row.examId, bucket);
  }

  const ranked: AcademicRankedRow[] = [];
  for (const bucket of byExam.values()) {
    ranked.push(
      ...rankResults(bucket, {
        score: (row) => row.rawPct,
        tieBreak: (row) => `${row.studentName}|${row.studentId}`,
      }),
    );
  }
  return ranked;
}

/** Rows as the report table consumes them. */
export function toAcademicResultItems(rows: readonly AcademicRankedRow[]): AcademicResultItem[] {
  return rows.map((row) => ({
    studentName: row.studentName,
    class: row.classLabel,
    subject: row.subject,
    marks: row.displayPct,
    total: 100,
    grade: row.grade,
    rank: row.rank,
  }));
}

/** Class (exam) leaderboard: average of raw percentages rounded once, not a mean of integers. */
export function summarizeClassRankings(rows: readonly AcademicScoredRow[]): ClassRankingItem[] {
  const byClass = new Map<string, AcademicScoredRow[]>();
  for (const row of rows) {
    const bucket = byClass.get(row.classLabel) ?? [];
    bucket.push(row);
    byClass.set(row.classLabel, bucket);
  }

  return [...byClass.entries()].map(([classLabel, classRows]) => {
    const top = [...classRows].sort((a, b) => b.rawPct - a.rawPct)[0];
    const averageRaw =
      classRows.reduce((sum, row) => sum + row.rawPct, 0) / Math.max(classRows.length, 1);
    const passingCount = classRows.filter((row) => row.passed).length;
    return {
      class: classLabel,
      averageMarks: Math.round(averageRaw),
      topMarks: top?.displayPct ?? 0,
      passRate: classRows.length > 0 ? Math.round((passingCount / classRows.length) * 100) : 0,
      topStudent: top?.studentName || "—",
    };
  });
}
