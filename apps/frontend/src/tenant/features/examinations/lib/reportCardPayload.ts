/**
 * @file reportCardPayload.ts
 * @description Maps one examination result into the flat report-card payload the
 * examinations template binds to.
 *
 * Results are stored per exam paper, so the report card carries a single subject row.
 * Aggregating a whole term's papers into one card is a separate feature.
 */

import { type TypstReportCardPayload } from "@mms/shared";
import { mapToTypstReportCard } from "@/components/template-editor/templatePayloadMappers";

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
