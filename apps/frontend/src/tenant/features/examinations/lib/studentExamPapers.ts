/**
 * @file studentExamPapers.ts
 * @description Collects a student's exam papers (exam + result) for the term report card.
 *
 * There is no term entity; a term is the set of papers the admin selects. This helper
 * only answers "which papers does this student actually have a result for?".
 */

import { type Exam, type ExamResult } from "@/lib/data/examinationData";

export interface StudentExamPaper {
  exam: Exam;
  result: ExamResult;
}

export function collectStudentPapers(
  exams: readonly Exam[],
  results: readonly ExamResult[],
  studentId: string,
): StudentExamPaper[] {
  const resultsByExamId = new Map<string, ExamResult>();
  for (const result of results) {
    if (String(result.studentId) === String(studentId)) {
      resultsByExamId.set(result.examId, result);
    }
  }

  const papers: StudentExamPaper[] = [];
  for (const exam of exams) {
    if (exam.deletedAt || exam.status === "cancelled") continue;
    const result = resultsByExamId.get(exam.id);
    if (!result) continue;
    papers.push({ exam, result });
  }

  return papers.sort(
    (first, second) =>
      first.exam.date.localeCompare(second.exam.date) ||
      (first.exam.subject || first.exam.name).localeCompare(
        second.exam.subject || second.exam.name,
      ),
  );
}
