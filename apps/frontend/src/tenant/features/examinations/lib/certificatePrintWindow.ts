import { mapToTypstReportCard } from "@/components/template-editor/templatePayloadMappers";
import { notify } from "@/lib/notify";
import type { StudentResultItem } from "@/tenant/features/examinations/components/StudentResultCard";
import type { Exam } from "@/lib/data/examinationData";

export { printHtmlDocument } from "@/lib/ui/printHtmlDocument";

export function exportTypstReportCard(
  result: StudentResultItem,
  exam: Exam,
  rankLabel: string,
): void {
  const gradeLabel = typeof result.grade === "string" ? result.grade : (result.grade?.label ?? "A");
  const payload = mapToTypstReportCard({
    studentName: result.student?.name,
    rollNumber: result.student?.rollNo,
    className: exam.subject,
    term: exam.name,
    totalMarks: exam.totalMarks,
    obtainedMarks: result.marksObtained,
    percentage: `${Math.round(result.pct)}%`,
    grade: gradeLabel,
    remarks: rankLabel,
    subjects: [
      {
        name: exam.subject,
        maxMarks: exam.totalMarks,
        obtainedMarks: result.marksObtained,
        grade: gradeLabel,
        remarks: rankLabel,
      },
    ],
  });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `typst-report-card-${payload.rollNumber || "exam"}.json`;
  a.click();
  URL.revokeObjectURL(url);
  notify.success("Typst report card payload exported");
}
