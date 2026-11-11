import { useEffect } from "react";
import { resolveResultScore, rankInExam, type Exam, type ExamResult } from "@mms/shared";
import { useStudentsByIds } from "@/tenant/hooks/collections/students";
import type { Student } from "@/lib/data/studentsData";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useEnrollmentsCollection } from "@/tenant/hooks/collections/enrollments";
import { useTranslation } from "@/hooks/useTranslation";
import type {
  RankedResult,
  ResultsViewStatsData,
} from "@/tenant/features/examinations/lib/resultsViewTypes";

export interface UseResultsViewDataOptions {
  exams: Exam[];
  results: ExamResult[];
  selectedExam: string;
  onFilteredCountChange?: (count: number) => void;
}

export type UseResultsViewDataResult = ReturnType<typeof useResultsViewData>;

export function useResultsViewData({
  exams,
  results,
  selectedExam,
  onFilteredCountChange,
}: UseResultsViewDataOptions) {
  const { t } = useTranslation();

  const exam = exams.find((examOption) => examOption.id === selectedExam);
  const examResults = exam ? results.filter((examResult) => examResult.examId === exam.id) : [];
  const studentIdsForExam = examResults.map((examResult) => examResult.studentId);

  const { data: students = [] } = useStudentsByIds(studentIdsForExam);
  const sessions = useSessionsCollection();
  const enrollments = useEnrollmentsCollection();

  const studentsById = (() => {
    const map = new Map<string, Student>();
    for (const student of students) {
      map.set(String(student.id), student);
    }
    return map;
  })();

  const classNamesById = (() => {
    const map = new Map<string, string>();
    for (const session of sessions) {
      if (session.classes) {
        for (const sessionClass of session.classes) {
          map.set(sessionClass.id, `${session.name} - ${sessionClass.name}`);
        }
      }
    }
    return map;
  })();

  const classByStudentId = (() => {
    const map = new Map<string, string>();
    if (exam?.classIds && exam.classIds.length > 0) {
      const classIds = new Set(exam.classIds);
      for (const enrollment of enrollments) {
        if (classIds.has(enrollment.classId)) {
          map.set(String(enrollment.studentId), enrollment.classId);
        }
      }
    }
    return map;
  })();

  /**
   * One scoring pass for the whole grid: raw-score grading (`resolveResultScore`) and competition
   * ranking with a deterministic tie-break, overall and per class. Ties share a rank (1, 1, 3) and
   * "class position" is the position inside the student's own class, not the exam-wide rank.
   */
  const rankedResults = (() => {
    if (!exam) return [] as RankedResult[];
    const scored = examResults.map((examResult) => {
      const student = studentsById.get(String(examResult.studentId));
      const classId = classByStudentId.get(String(examResult.studentId));
      const score = resolveResultScore({
        marksObtained: examResult.marksObtained,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        graceMarks: examResult.graceMarks,
      });
      return {
        ...examResult,
        student: student
          ? {
              name: student.name || t("common.unnamedStudent"),
              rollNo: student.grNumber || String(student.id),
            }
          : undefined,
        cls: classId ? { name: classNamesById.get(classId) || classId } : undefined,
        classId: classId ?? "",
        pct: score.displayPercentage,
        percentage: score.percentage,
        rawPercentage: score.rawPercentage,
        effectiveMarks: score.effectiveMarks,
        grade: score.grade,
        passed: score.passed,
      };
    });

    const ranked = rankInExam(scored, {
      score: (row) => row.effectiveMarks,
      classId: (row) => row.classId,
      tieBreak: (row) => `${row.student?.rollNo ?? ""}|${row.studentId}`,
    });

    return ranked;
  })();

  useEffect(() => {
    onFilteredCountChange?.(rankedResults.length);
  }, [rankedResults.length, onFilteredCountChange]);

  const stats = (() => {
    if (rankedResults.length === 0) return null;
    // Average of the raw percentages, rounded once — the previous mean of already-rounded
    // percentages drifted by up to half a point (the code summed `percentage`, the comment lied).
    const totalRaw = rankedResults.reduce(
      (sum, rankedResult) => sum + rankedResult.rawPercentage,
      0,
    );
    const passed = rankedResults.filter((rankedResult) => rankedResult.passed).length;
    return {
      average: Math.round(totalRaw / rankedResults.length),
      passed,
      failed: rankedResults.length - passed,
      total: rankedResults.length,
    };
  })() as ResultsViewStatsData | null;

  return { exam, rankedResults, stats };
}
