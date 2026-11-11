/**
 * @file reportCardPayload.ts
 * @description Maps one examination result into the flat report-card payload the
 * examinations template binds to.
 *
 * `buildReportCardPayload` maps a single paper; `buildTermReportCardPayload` maps a
 * selected set of papers into the same subject-table template.
 */

import { type TypstReportCardPayload } from "@mms/shared";
import { mapToTypstReportCard } from "@/components/template-editor/templatePayloadMappers";
import { resolveResultScore } from "@mms/shared";

/** Structural subset of `StudentResultItem` (avoids importing the component). */
export interface ReportCardResultInput {
  pct: number;
  marksObtained: number;
  grade: { label: string };
  /** Class position, when the caller has it (the drawer/certificate ranking). */
  classRank?: number;
  classSize?: number;
  graceMarks?: number;
  student?: { name: string; rollNo: string };
  cls?: { name: string };
}

/** Structural subset of `Exam`. */
export interface ReportCardExamInput {
  name: string;
  subject?: string;
  totalMarks: number;
  date: string;
}

export interface BuildReportCardPayloadOptions {
  result: ReportCardResultInput;
  exam: ReportCardExamInput;
  institution: string;
}

export function buildReportCardPayload({
  result,
  exam,
  institution,
}: BuildReportCardPayloadOptions): TypstReportCardPayload {
  const subjectName = exam.subject || exam.name;
  // The printed row must equal the printed total: the term card already scores through the engine
  // (grace included), so a single-paper card using the raw mark silently disagreed when grace > 0.
  const score = resolveResultScore({
    marksObtained: result.marksObtained,
    totalMarks: exam.totalMarks,
    passingMarks: 0,
    graceMarks: result.graceMarks,
  });

  return mapToTypstReportCard({
    institution,
    studentName: result.student?.name ?? "",
    rollNumber: result.student?.rollNo ?? "",
    className: result.cls?.name ?? "",
    term: exam.name,
    academicYear: exam.date.slice(0, 4),
    subjects: [
      {
        name: subjectName,
        maxMarks: exam.totalMarks,
        obtainedMarks: score.effectiveMarks,
        grade: result.grade.label,
        remarks: "",
      },
    ],
    totalMarks: exam.totalMarks,
    obtainedMarks: score.effectiveMarks,
    percentage: `${Math.round(result.pct)}%`,
    grade: result.grade.label,
    ...(typeof result.classRank === "number" ? { rank: String(result.classRank) } : {}),
    ...(typeof result.classSize === "number" ? { classSize: result.classSize } : {}),
    // Attendance and remarks are not part of the result record; bound fields print
    // empty rather than inventing values.
    attendance: "",
    remarks: "",
  });
}

/** One selected paper for a term report card. */
export interface TermReportPaper {
  exam: ReportCardExamInput;
  result: { marksObtained: number; graceMarks?: number };
}

export interface BuildTermReportCardPayloadOptions {
  result: ReportCardResultInput;
  papers: readonly TermReportPaper[];
  institution: string;
  /** Label used when the selected papers do not share one exam/term name. */
  mixedTermLabel: string;
}

function yearRange(papers: readonly TermReportPaper[]): string {
  const years = [...new Set(papers.map((paper) => paper.exam.date.slice(0, 4)))].sort();
  if (years.length === 0) return "";
  return years.length === 1 ? years[0]! : `${years[0]}–${years[years.length - 1]}`;
}

export function buildTermReportCardPayload({
  result,
  papers,
  institution,
  mixedTermLabel,
}: BuildTermReportCardPayloadOptions): TypstReportCardPayload {
  const subjects = papers.map(({ exam, result: paperResult }) => {
    // Same engine as the grid: raw-score grading, grace included, no unrounded/rounded split.
    const score = resolveResultScore({
      marksObtained: paperResult.marksObtained,
      totalMarks: exam.totalMarks,
      passingMarks: 0,
      graceMarks: paperResult.graceMarks,
    });
    return {
      name: exam.subject || exam.name,
      maxMarks: exam.totalMarks,
      obtainedMarks: score.effectiveMarks,
      grade: score.grade.label,
      remarks: "",
    };
  });

  const totalMarks = papers.reduce((sum, paper) => sum + paper.exam.totalMarks, 0);
  const obtainedMarks = papers.reduce((sum, paper) => {
    const score = resolveResultScore({
      marksObtained: paper.result.marksObtained,
      totalMarks: paper.exam.totalMarks,
      passingMarks: 0,
      graceMarks: paper.result.graceMarks,
    });
    return sum + score.effectiveMarks;
  }, 0);
  const aggregate = resolveResultScore({
    marksObtained: obtainedMarks,
    totalMarks,
    passingMarks: 0,
  });
  const percentage = aggregate.displayPercentage;
  const termNames = new Set(papers.map((paper) => paper.exam.name));

  return mapToTypstReportCard({
    institution,
    studentName: result.student?.name ?? "",
    rollNumber: result.student?.rollNo ?? "",
    className: result.cls?.name ?? "",
    term: termNames.size === 1 ? [...termNames][0]! : mixedTermLabel,
    academicYear: yearRange(papers),
    subjects,
    totalMarks,
    obtainedMarks,
    percentage: `${percentage}%`,
    grade: aggregate.grade.label,
    ...(typeof result.classRank === "number" ? { rank: String(result.classRank) } : {}),
    ...(typeof result.classSize === "number" ? { classSize: result.classSize } : {}),
    // Term-wide attendance/remarks are not modelled; bound fields print empty.
    attendance: "",
    remarks: "",
  });
}
