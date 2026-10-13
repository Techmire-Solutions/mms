/**
 * @file examinationsModuleManifest.ts
 * @description Examinations module manifest, DTO validation schemas, and types.
 */
import type { Permission } from "../auth/permissions.js";
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";

/** Zod schema for single Exam record. */
export const examRecordSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    subject: z.string().default(""),
    totalMarks: z.number().default(100),
    passingMarks: z.number().default(50),
    date: z.string(),
    duration: z.number().default(60),
    classIds: z.array(z.string()).default([]),
    status: z
      .enum(["completed", "scheduled", "cancelled", "upcoming", "ongoing"])
      .default("upcoming"),
    description: z.string().default(""),
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
    restoredAt: z.string().nullable().optional(),
    restoredBy: z.string().nullable().optional(),
    deletedWithCascade: z.boolean().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const examRecordInsertSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, "Exam name is required"),
    subject: z.string().optional().default(""),
    totalMarks: z.number().positive().default(100),
    passingMarks: z.number().nonnegative().default(50),
    date: isoDateSchema,
    duration: z.number().positive().default(60),
    classIds: z.array(z.string()).optional().default([]),
    status: z
      .enum(["completed", "scheduled", "cancelled", "upcoming", "ongoing"])
      .optional()
      .default("upcoming"),
    description: z.string().optional().default(""),
  })
  .strict();

export const examRecordUpdateSchema = examRecordInsertSchema.partial().strict();

export type Exam = z.infer<typeof examRecordSchema>;
export type ExamInsert = z.infer<typeof examRecordInsertSchema>;
export type ExamUpdate = z.infer<typeof examRecordUpdateSchema>;
export const examListSchema = z.array(examRecordSchema);

export function isExamDeleted(exam: { deletedAt?: string | null }): boolean {
  return Boolean(exam.deletedAt);
}

export function filterActiveExams<T extends { deletedAt?: string | null }>(exams: T[]): T[] {
  return exams.filter((e) => !isExamDeleted(e));
}

/** Zod schema for single Exam Result entry. */
export const examResultRecordSchema = z
  .object({
    id: z.string(),
    examId: z.string(),
    studentId: z.string(),
    marksObtained: z.number().default(0),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const examResultRecordInsertSchema = z
  .object({
    id: z.string().optional(),
    examId: z.string().min(1, "Exam ID is required"),
    studentId: z.string().min(1, "Student ID is required"),
    marksObtained: z.number().nonnegative().default(0),
  })
  .strict();

export const examResultRecordUpdateSchema = examResultRecordInsertSchema.partial().strict();

export type ExamResult = z.infer<typeof examResultRecordSchema>;
export type ExamResultInsert = z.infer<typeof examResultRecordInsertSchema>;
export type ExamResultUpdate = z.infer<typeof examResultRecordUpdateSchema>;
export const examResultListSchema = z.array(examResultRecordSchema);

/** Examinations module manifest — aligns with MMS universal module architecture. */
export const EXAMINATIONS_MODULE_MANIFEST = {
  moduleId: "examinations",
  entityType: "Exam",
  collectionKey: "exams",
  resultsCollectionKey: "exam_results",
  settingsObjectKey: "examinations_settings",
  examColumnPreferencesObjectKey: "examination_exam_user_column_preferences",
  resultsColumnPreferencesObjectKey: "examination_results_user_column_preferences",
  restBasePath: "/api/examinations",
  analyticsCategory: "examinations",
  tiers: ["work", "reports", "setup"] as const,
  setupSubTabs: ["preferences", "templates"] as const,
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    exportsIncludeDeleted: false,
    captureDeletionReason: false,
    retentionDays: null,
  },
  permissions: {
    read: "students.read",
    write: "students.write",
    delete: "students.write",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    export: "students.read",
    reports: "students.read",
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ["exams", "results"] as const,
    bulkActions: ["delete"] as const,
  },
  defaultPageSize: 12,
  maxPageSize: 100,
} as const;

export type ExaminationsModuleManifest = typeof EXAMINATIONS_MODULE_MANIFEST;
export type ExaminationsModuleTier = (typeof EXAMINATIONS_MODULE_MANIFEST.tiers)[number];
