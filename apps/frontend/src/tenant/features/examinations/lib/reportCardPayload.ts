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
import { getGrade } from "./gradeUtils";

/** Structural subset of `StudentResultItem` (avoids importing the component). */
export interface ReportCardResultInput {
  pct: number;
  marksObtained: number;
  grade: { label: string };
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
        obtainedMarks: result.marksObtained,
        grade: result.grade.label,
        remarks: "",
      },
    ],
    totalMarks: exam.totalMarks,
    obtainedMarks: result.marksObtained,
    percentage: `${Math.round(result.pct)}%`,
    grade: result.grade.label,
    // Attendance and remarks are not part of the result record; bound fields print
    // empty rather than inventing values.
    attendance: "",
    remarks: "",
  });
}

/** One selected paper for a term report card. */
export interface TermReportPaper {
  exam: ReportCardExamInput;
  result: { marksObtained: number };
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
    const percentage =
      exam.totalMarks > 0 ? (paperResult.marksObtained / exam.totalMarks) * 100 : 0;
    return {
      name: exam.subject || exam.name,
      maxMarks: exam.totalMarks,
      obtainedMarks: paperResult.marksObtained,
      grade: getGrade(percentage).label,
      remarks: "",
    };
  });

  const totalMarks = papers.reduce((sum, paper) => sum + paper.exam.totalMarks, 0);
  const obtainedMarks = papers.reduce((sum, paper) => sum + paper.result.marksObtained, 0);
  const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;
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
    grade: getGrade(percentage).label,
    // Term-wide attendance/remarks are not modelled; bound fields print empty.
    attendance: "",
    remarks: "",
  });
}
