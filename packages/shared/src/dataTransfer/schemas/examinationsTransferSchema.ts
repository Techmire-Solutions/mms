/**
 * @file examinationsTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Examinations.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface ExaminationTransferEntity {
  title: string;
  subject?: string;
  examDate?: string;
  totalMarks?: number;
  passingMarks?: number;
  gradingScale?: string;
  status?: string;
  notes?: string;
}

export const examinationsTransferSchema: ModuleTransferSchema<ExaminationTransferEntity> =
  createModuleTransferSchema<ExaminationTransferEntity>({
    moduleId: "examinations",
    entityNounPlural: "examinations",
    defaultFilename: "examinations.csv",
    fields: [
      {
        key: "title",
        label: "Examination Title",
        aliases: ["exam_title", "Exam Name", "Title"],
        required: true,
        sample: "Midterm Evaluation 2024",
        extract: (e) => e.title || "",
      },
      {
        key: "subject",
        label: "Subject",
        aliases: ["course", "Discipline"],
        sample: "Tajweed Rules",
        extract: (e) => e.subject || "",
      },
      {
        key: "examDate",
        label: "Examination Date",
        aliases: ["date", "Schedule"],
        sample: "2024-11-15",
        extract: (e) => e.examDate || "",
      },
      {
        key: "totalMarks",
        label: "Total Marks",
        aliases: ["max_marks", "Total"],
        sample: 100,
        extract: (e) => (e.totalMarks != null ? String(e.totalMarks) : "100"),
        parse: (raw) => (raw ? Number(raw) : undefined),
      },
      {
        key: "passingMarks",
        label: "Passing Marks",
        aliases: ["pass_marks", "Pass Mark"],
        sample: 50,
        extract: (e) => (e.passingMarks != null ? String(e.passingMarks) : "50"),
        parse: (raw) => (raw ? Number(raw) : undefined),
      },
      {
        key: "gradingScale",
        label: "Grading Scale",
        aliases: ["scale", "Grade System"],
        sample: "Standard Letter (A-F)",
        extract: (e) => e.gradingScale || "",
      },
      {
        key: "status",
        label: "Status",
        aliases: ["Exam Status"],
        sample: "scheduled",
        extract: (e) => e.status || "scheduled",
      },
      {
        key: "notes",
        label: "Notes / Guidelines",
        aliases: ["instructions", "Remarks"],
        sample: "Oral evaluation in room 302",
        extract: (e) => e.notes || "",
      },
    ],
  });

registerModuleTransferSchema(examinationsTransferSchema);
