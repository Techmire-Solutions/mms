/**
 * @file ExaminationTemplateEditor.tsx
 * @description Examinations module report card and certificate template editor.
 *
 * Persistence lives in `DocumentTemplateEditor` (`/api/templates/:key`); this wrapper
 * only supplies examination fields, presets, sample payload and the Typst export.
 */

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import { DocumentTemplateEditor } from "@/components/app/DocumentTemplateEditor";
import { type TypstReportCardPayload } from "@mms/shared";
import { mapToTypstReportCard } from "@/components/template-editor/templatePayloadMappers";
import { notify } from "@/lib/notify";
import {
  EXAMINATION_TEMPLATE_STORAGE_KEY,
  EXAMINATION_AVAILABLE_FIELDS,
  DEFAULT_EXAMINATION_TEMPLATE,
  EXAMINATION_PRESETS,
} from "@/tenant/features/examinations/lib/examinationTemplateData";

export interface ExaminationTemplateEditorProps {
  /** Leaving the Templates sub-tab (or closing the modal). */
  onClose: () => void;
  /** Reports unsaved layout changes to the Setup leave-guard. */
  onDirtyChange?: (dirty: boolean) => void;
  fullscreen?: boolean;
}

export function ExaminationTemplateEditor({
  onClose,
  onDirtyChange,
  fullscreen = false,
}: ExaminationTemplateEditorProps): React.JSX.Element {
  const sampleData: TypstReportCardPayload = {
    institution: "Madrasa Management System",
    studentName: "Fatima Al-Zahra",
    rollNumber: "EX-1092",
    className: "Advanced Tajweed",
    term: "نهاية الفصل الدراسي الأول",
    academicYear: "1447-1448",
    subjects: [
      {
        name: "Quran Memorization",
        maxMarks: 100,
        obtainedMarks: 98,
        grade: "A+",
        remarks: "Excellent recitation",
      },
      {
        name: "Tajweed Rules",
        maxMarks: 100,
        obtainedMarks: 95,
        grade: "A",
        remarks: "Solid understanding",
      },
      {
        name: "Islamic Studies",
        maxMarks: 100,
        obtainedMarks: 92,
        grade: "A",
        remarks: "Great progress",
      },
    ],
    totalMarks: 300,
    obtainedMarks: 285,
    percentage: "95%",
    grade: "ممتاز (Excellent)",
    attendance: "98%",
    remarks: "مستوى ممتاز وتقدم ملحوظ خلال الفصل الدراسي",
  };

  const { t } = useTranslation();
  const branding = useBranding();

  const handleExportTypst = (payload: TypstReportCardPayload) => {
    const conforming = mapToTypstReportCard({ ...payload });
    const jsonStr = JSON.stringify(conforming, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `typst-report-card-${conforming.rollNumber}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify.success(t("templateEditor.typstExported"));
  };

  return (
    <div className="min-w-0">
      <DocumentTemplateEditor<TypstReportCardPayload>
        templateKey={EXAMINATION_TEMPLATE_STORAGE_KEY}
        defaultTemplate={DEFAULT_EXAMINATION_TEMPLATE}
        savedMessage={t("examinations.templateSaved")}
        title={t("examinations.templateEditorTitle")}
        availableFields={EXAMINATION_AVAILABLE_FIELDS}
        presets={EXAMINATION_PRESETS}
        documentType="report-card"
        sampleData={sampleData}
        fullscreen={fullscreen}
        branding={branding}
        onClose={onClose}
        onDirtyChange={onDirtyChange}
        onExportTypst={handleExportTypst}
      />
    </div>
  );
}

export default ExaminationTemplateEditor;
