import { mapToTypstReportCard } from "@/components/ui/template-editor/templatePayloadMappers";
import { notify } from "@/lib/notify";
import type { StudentResultItem } from "@/tenant/features/examinations/components/StudentResultCard";
import type { Exam } from "@/lib/data/examinationData";

export function printHtmlDocument(title: string, content: string): void {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', sans-serif; background: white; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  void win.document.fonts.ready.then(() => {
    win.print();
    win.close();
  });
}

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
