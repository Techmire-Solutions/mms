/**
 * @file ExaminationTemplateEditor.tsx
 * @description Examinations module report card and certificate template editor wrapping the SSOT TemplateEditor.
 */

import React, { useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import { TemplateEditor } from "@/components/app/TemplateEditor";
import { getObject, saveObject } from "@/lib/db";
import { saveDocumentTemplateServer } from "@/lib/templates/documentTemplatesApi";
import { type DocumentTemplate, type TypstReportCardPayload } from "@mms/shared";
import { mapToTypstReportCard } from "@/components/template-editor/templatePayloadMappers";
import { notify } from "@/lib/notify";
import {
  EXAMINATION_TEMPLATE_STORAGE_KEY,
  EXAMINATION_AVAILABLE_FIELDS,
  DEFAULT_EXAMINATION_TEMPLATE,
  EXAMINATION_PRESETS,
} from "@/tenant/features/examinations/lib/examinationTemplateData";

export interface ExaminationTemplateEditorProps {
  onClose?: () => void;
  fullscreen?: boolean;
}

export function ExaminationTemplateEditor({
  onClose = () => {},
  fullscreen = false,
}: ExaminationTemplateEditorProps): React.JSX.Element {
  const currentTemplate = useMemo(() => {
    return getObject<DocumentTemplate<TypstReportCardPayload>>(
      EXAMINATION_TEMPLATE_STORAGE_KEY,
      DEFAULT_EXAMINATION_TEMPLATE,
    );
  }, []);

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

  const handleSave = async (tmpl: DocumentTemplate<TypstReportCardPayload>) => {
    saveObject(EXAMINATION_TEMPLATE_STORAGE_KEY, tmpl);
    try {
      await saveDocumentTemplateServer(EXAMINATION_TEMPLATE_STORAGE_KEY, tmpl);
      notify.success(t("examinations.templateSaved"));
    } catch (err) {
      console.warn("[ExaminationTemplateEditor] Server save failed:", err);
      notify.error(t("templateEditor.saveFailed"));
      throw err;
    }
  };

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
    <TemplateEditor<TypstReportCardPayload>
      title={t("examinations.templateEditorTitle")}
      template={currentTemplate}
      defaultTemplate={DEFAULT_EXAMINATION_TEMPLATE}
      availableFields={EXAMINATION_AVAILABLE_FIELDS}
      presets={EXAMINATION_PRESETS}
      documentType="report-card"
      sampleData={sampleData}
      fullscreen={fullscreen}
      branding={branding}
      onSave={handleSave}
      onClose={onClose}
      onExportTypst={handleExportTypst}
    />
  );
}

export default ExaminationTemplateEditor;
