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

/**
 * Default paper selection for the term report card opened from one exam.
 *
 * A "term" is the selected set of papers; the default is the current exam's name **within the same
 * calendar year**. Matching the name alone preselected a previous year's identically named exam
 * into the same card (the card then printed a year range).
 */
export function initialTermPaperSelection(
  papers: readonly StudentExamPaper[],
  currentExamId: string,
): Set<string> {
  const current = papers.find((paper) => paper.exam.id === currentExamId);
  if (!current) return new Set();
  const termName = current.exam.name;
  const termYear = current.exam.date.slice(0, 4);
  const preselected = papers.filter(
    (paper) =>
      paper.exam.id === currentExamId ||
      (paper.exam.name === termName && paper.exam.date.slice(0, 4) === termYear),
  );
  return new Set(preselected.map((paper) => paper.exam.id));
}
