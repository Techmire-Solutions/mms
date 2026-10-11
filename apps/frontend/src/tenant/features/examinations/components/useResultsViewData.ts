import { useEffect } from "react";
import { type Exam, type ExamResult } from "@/lib/data/examinationData";
import { useStudentsByIds } from "@/tenant/hooks/collections/students";
import type { Student } from "@/lib/data/studentsData";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useEnrollmentsCollection } from "@/tenant/hooks/collections/enrollments";
import { getGrade } from "@/tenant/features/examinations/components/gradeUtils";
import { useTranslation } from "@/hooks/useTranslation";
import type {
  RankedResult,
  ResultsViewStatsData,
} from "@/tenant/features/examinations/components/resultsViewTypes";

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
  const studentIdsForExam = (() => {
    if (!exam) return [];
    return results
      .filter((examResult) => examResult.examId === exam.id)
      .map((examResult) => examResult.studentId);
  })();

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

  const rankedResults = (() => {
    if (!exam) return [];
    return results
      .filter((examResult) => examResult.examId === exam.id)
      .map((examResult) => {
        const student = studentsById.get(String(examResult.studentId));
        const classId = classByStudentId.get(String(examResult.studentId));
        const percentage = Math.round((examResult.marksObtained / exam.totalMarks) * 100);
        return {
          ...examResult,
          student: student
            ? {
                name: student.name || t("common.unnamedStudent"),
                rollNo: student.grNumber || String(student.id),
              }
            : undefined,
          cls: classId ? { name: classNamesById.get(classId) || classId } : undefined,
          pct: percentage,
          grade: getGrade(percentage),
          passed: examResult.marksObtained >= exam.passingMarks,
        };
      })
      .sort((firstResult, secondResult) => secondResult.marksObtained - firstResult.marksObtained)
      .map((rankedResult, index) => ({ ...rankedResult, rank: index + 1 }));
  })() as RankedResult[];

  useEffect(() => {
    onFilteredCountChange?.(rankedResults.length);
  }, [rankedResults.length, onFilteredCountChange]);

  const stats = (() => {
    if (rankedResults.length === 0) return null;
    let sumPct = 0;
    let passed = 0;
    for (const rankedResult of rankedResults) {
      sumPct += rankedResult.pct;
      if (rankedResult.passed) passed++;
    }
    const average = Math.round(sumPct / rankedResults.length);
    return { average, passed, failed: rankedResults.length - passed, total: rankedResults.length };
  })() as ResultsViewStatsData | null;

  return { exam, rankedResults, stats };
}
