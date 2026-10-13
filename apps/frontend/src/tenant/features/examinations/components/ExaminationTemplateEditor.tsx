/**
 * @file ExaminationTemplateEditor.tsx
 * @description Examinations module report card and certificate template editor wrapping the SSOT TemplateEditor.
 */

import React, { useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import { TemplateEditor } from "@/components/app/TemplateEditor";
import { getObject, saveObject } from "@/lib/db";
import {
  type DocumentTemplate,
  type DocumentTemplatePreset,
  type TemplateFieldDefinition,
  type TypstReportCardPayload,
} from "@mms/shared";
import { mapToTypstReportCard } from "@/components/template-editor/templatePayloadMappers";
import { notify } from "@/lib/notify";
import {
  PRINT_SLATE_DARK,
  PRINT_SLATE_MEDIUM,
  PRINT_SLATE_MUTED,
  PRINT_BLUE_DEEP,
  PRINT_AMBER_DEEP,
  PRINT_EMERALD_DEEP,
} from "@/lib/ui/printTemplateStyles";

export const EXAMINATION_TEMPLATE_STORAGE_KEY = "mms_examination_report_template";

export const EXAMINATION_AVAILABLE_FIELDS: TemplateFieldDefinition<TypstReportCardPayload>[] = [
  { field: "studentName", label: "Student Name", sampleValue: "Fatima Al-Zahra" },
  { field: "rollNumber", label: "Roll Number", sampleValue: "EX-1092" },
  { field: "className", label: "Class / Grade", sampleValue: "Advanced Tajweed" },
  { field: "term", label: "Exam Term", sampleValue: "Mid-Term 1447" },
  { field: "academicYear", label: "Academic Year", sampleValue: "1447-1448" },
  { field: "totalMarks", label: "Total Marks", sampleValue: 500 },
  { field: "obtainedMarks", label: "Obtained Marks", sampleValue: 475 },
  { field: "percentage", label: "Percentage %", sampleValue: "95%" },
  { field: "grade", label: "Grade", sampleValue: "ممتاز (Excellent)" },
  { field: "attendance", label: "Attendance %", sampleValue: "98%" },
  { field: "remarks", label: "Remarks", sampleValue: "Outstanding achievement" },
  { field: "institution", label: "Institution Name", sampleValue: "Madrasa Management System" },
];

// Print tokens imported from lib/printTemplateStyles.ts SSOT.
const PRINT_EXAM_SLATE_DARK = PRINT_SLATE_DARK;
const PRINT_EXAM_SLATE = PRINT_SLATE_MEDIUM;
const PRINT_EXAM_SLATE_MUTED = PRINT_SLATE_MUTED;
const PRINT_EXAM_SKY_DEEP = PRINT_BLUE_DEEP;
const PRINT_EXAM_AMBER_DEEP = PRINT_AMBER_DEEP;
const PRINT_EXAM_EMERALD_DEEP = PRINT_EMERALD_DEEP;

export const DEFAULT_EXAMINATION_TEMPLATE: DocumentTemplate<TypstReportCardPayload> = {
  pageSize: "A4",
  orientation: "portrait",
  elements: [
    {
      id: "e_inst",
      type: "field",
      field: "institution",
      label: "Madrasa Management System",
      x: 40,
      y: 40,
      w: 714,
      h: 32,
      style: { fontSize: 20, fontWeight: "bold", textAlign: "center" },
    },
    {
      id: "e_title",
      type: "static",
      label: "بطاقة تقييم الأداء والدرجات | Report Card",
      x: 40,
      y: 78,
      w: 714,
      h: 22,
      style: { fontSize: 13, textAlign: "center", color: PRINT_EXAM_SLATE },
    },
    {
      id: "e_term",
      type: "field",
      field: "term",
      label: "العام الدراسي: 1447 - نهاية الفصل الدراسي",
      x: 40,
      y: 104,
      w: 714,
      h: 18,
      style: { fontSize: 10, textAlign: "center", color: PRINT_EXAM_SLATE_MUTED },
    },
    {
      id: "e_div1",
      type: "divider",
      label: "",
      x: 40,
      y: 130,
      w: 714,
      h: 1,
      style: { color: PRINT_EXAM_SLATE_DARK },
    },
    {
      id: "e_stud",
      type: "field",
      field: "studentName",
      label: "الطالب: Fatima Al-Zahra",
      x: 40,
      y: 146,
      w: 320,
      h: 20,
      style: { fontSize: 11, fontWeight: "bold" },
    },
    {
      id: "e_roll",
      type: "field",
      field: "rollNumber",
      label: "رقم القيد: EX-1092",
      x: 420,
      y: 146,
      w: 334,
      h: 20,
      style: { fontSize: 11, textAlign: "right" },
    },
    {
      id: "e_class",
      type: "field",
      field: "className",
      label: "الصف: Advanced Tajweed",
      x: 40,
      y: 172,
      w: 320,
      h: 20,
      style: { fontSize: 11 },
    },
    {
      id: "e_att",
      type: "field",
      field: "attendance",
      label: "نسبة الحضور: 98%",
      x: 420,
      y: 172,
      w: 334,
      h: 20,
      style: { fontSize: 11, textAlign: "right" },
    },
    {
      id: "e_grd",
      type: "field",
      field: "grade",
      label: "التقدير العام: ممتاز (Excellent)",
      x: 40,
      y: 220,
      w: 320,
      h: 24,
      style: { fontSize: 13, fontWeight: "bold", color: PRINT_EXAM_SKY_DEEP },
    },
    {
      id: "e_pct",
      type: "field",
      field: "percentage",
      label: "النسبة: 95%",
      x: 420,
      y: 220,
      w: 334,
      h: 24,
      style: { fontSize: 13, fontWeight: "bold", textAlign: "right" },
    },
    {
      id: "e_rem",
      type: "field",
      field: "remarks",
      label: "ملاحظات: مستوى ممتاز وتقدم ملحوظ",
      x: 40,
      y: 260,
      w: 714,
      h: 40,
      style: { fontSize: 11, color: PRINT_EXAM_SLATE },
    },
    { id: "e_qr", type: "qrcode", label: "QR Verification", x: 674, y: 320, w: 80, h: 80 },
  ],
};

export const EXAMINATION_PRESETS: DocumentTemplatePreset<TypstReportCardPayload>[] = [
  {
    key: "report_card_typst",
    label: "Typst BiDi Report Card (A4)",
    description: "Conforming Typst report-card.typ compiler format",
    template: DEFAULT_EXAMINATION_TEMPLATE,
  },
  {
    key: "certificate_a4_landscape",
    label: "Honor Certificate (A4 Landscape)",
    description: "Formal horizontal graduation and award certificate",
    template: {
      pageSize: "A4",
      orientation: "landscape",
      elements: [
        {
          id: "c_inst",
          type: "field",
          field: "institution",
          label: "Madrasa Management System",
          x: 60,
          y: 50,
          w: 1003,
          h: 36,
          style: { fontSize: 24, fontWeight: "bold", textAlign: "center" },
        },
        {
          id: "c_title",
          type: "static",
          label: "شهادة تقدير وتفوق | Certificate of Excellence",
          x: 60,
          y: 95,
          w: 1003,
          h: 28,
          style: { fontSize: 16, textAlign: "center", color: PRINT_EXAM_AMBER_DEEP },
        },
        {
          id: "c_stud",
          type: "field",
          field: "studentName",
          label: "Fatima Al-Zahra",
          x: 60,
          y: 160,
          w: 1003,
          h: 36,
          style: {
            fontSize: 22,
            fontWeight: "bold",
            textAlign: "center",
            color: PRINT_EXAM_SLATE_DARK,
          },
        },
        {
          id: "c_rem",
          type: "field",
          field: "remarks",
          label: "For exceptional performance and dedication",
          x: 60,
          y: 210,
          w: 1003,
          h: 24,
          style: { fontSize: 13, textAlign: "center" },
        },
        {
          id: "c_grd",
          type: "field",
          field: "grade",
          label: "Grade: ممتاز (Excellent)",
          x: 60,
          y: 250,
          w: 1003,
          h: 24,
          style: {
            fontSize: 14,
            fontWeight: "bold",
            textAlign: "center",
            color: PRINT_EXAM_EMERALD_DEEP,
          },
        },
      ],
    },
  },
];

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

  const handleSave = (tmpl: DocumentTemplate<TypstReportCardPayload>) => {
    saveObject(EXAMINATION_TEMPLATE_STORAGE_KEY, tmpl);
    notify.success(t("examinations.templateSaved"));
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
