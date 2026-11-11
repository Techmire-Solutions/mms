/**
 * @file examinationsModuleManifest.ts
 * @description Examinations module manifest, DTO validation schemas, and types.
 */
import type { Permission } from "../auth/permissions.js";
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { EXAM_STATUSES } from "./examLifecycle.js";

/**
 * Upper bound of the `exam_results.marks_obtained` column (`numeric(8,2)`, migration 0236).
 * The per-exam ceiling is enforced against `exams.total_marks` server-side and by a DB trigger.
 * Declared before the schemas because the exam DTOs cap their integer authoring fields with it.
 */
export const MAX_MARKS_OBTAINED = 999999.99;

/**
 * Upper bound of the `exam_results.grace_marks` column (`numeric(6,2)`, migration 0237).
 *
 * Moderation used to validate against {@link MAX_MARKS_OBTAINED} (999999.99) while the column only
 * holds 9999.99, so a large grace value reached Postgres as `22003 numeric overflow` — a 500.
 * Targeting the DTO/validation at the column's real range keeps the API surface honest.
 */
export const MAX_GRACE_MARKS = 9999.99;

/** Zod schema for single Exam record. */
export const examRecordSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    subject: z.string().default(""),
    /** `subjects.id`; `subject` is the display snapshot. */
    subjectId: z.string().optional(),
    totalMarks: z.number().int().default(100),
    passingMarks: z.number().int().default(50),
    date: z.string(),
    duration: z.number().int().default(60),
    classIds: z.array(z.string()).default([]),
    status: z.enum(EXAM_STATUSES).default("upcoming"),
    description: z.string().default(""),
    /**
     * Per-exam attendance gate (migration 0237); `null` inherits the session threshold. Exposed so
     * the UI can show the threshold it enforces — the column previously had no DTO field at all.
     */
    minAttendancePct: z.number().min(0).max(100).nullable().optional(),
    /**
     * Publication stamp (migration 0207/0222). Non-null means the results are published and the
     * marks are immutable until an administrative unlock. Exposed so the UI can lock the grid —
     * without it, publication state was write-only and no client could enforce the lock.
     */
    resultsFinalizedAt: z.string().nullable().optional(),
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
    subjectId: z.string().optional(),
    totalMarks: z.number().int().positive().max(MAX_MARKS_OBTAINED).default(100),
    passingMarks: z.number().int().nonnegative().default(50),
    date: isoDateSchema,
    duration: z.number().int().positive().default(60),
    classIds: z.array(z.string()).optional().default([]),
    status: z.enum(EXAM_STATUSES).optional().default("upcoming"),
    description: z.string().optional().default(""),
  })
  .strict();

export const examRecordUpdateSchema = examRecordInsertSchema.partial().strict();

export type Exam = z.infer<typeof examRecordSchema>;
export type ExamInsert = z.infer<typeof examRecordInsertSchema>;
export type ExamUpdate = z.infer<typeof examRecordUpdateSchema>;
/**
 * Largest accepted exam batch. Exams are edited a handful at a time; the cap keeps a malformed
 * request from opening an unbounded write transaction.
 */
export const examListSchema = z.array(examRecordSchema).max(1000);

/**
 * Write body for the exams bulk upsert (`PUT /api/examinations/exams/bulk`).
 *
 * The read record used to double as the write boundary, so an invalid `date` was stored as NULL
 * (`toDbDate` coerces anything unparseable), a blank `name` and non-positive/non-ordered marks only
 * failed later at the DB checks, and the DTO advertised server-owned fields. This schema validates
 * the mutable surface strictly while still accepting the read-only metadata the list→save round-trip
 * carries (`deletedAt`, `resultsFinalizedAt`, `createdAt`, …); the persist layer has always ignored
 * those and continues to own deletion/publication.
 */
const examBulkWriteRowSchema = examRecordSchema
  .extend({
    id: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1, "Exam name is required").max(200),
    date: isoDateSchema,
    totalMarks: z.number().int().positive().max(MAX_MARKS_OBTAINED),
    passingMarks: z.number().int().nonnegative(),
    duration: z.number().int().positive(),
    classIds: z.array(z.string().trim().min(1).max(128)).max(100),
    description: z.string().max(2000),
  })
  .strict()
  .superRefine((exam, ctx) => {
    if (exam.passingMarks > exam.totalMarks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passingMarks"],
        message: "Passing marks cannot exceed the total marks",
      });
    }
  });

export const examBulkWriteSchema = z.array(examBulkWriteRowSchema).max(1000);
export type ExamBulkWrite = z.infer<typeof examBulkWriteSchema>[number];

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
    marksObtained: z.number().nonnegative().max(MAX_MARKS_OBTAINED).default(0),
    /**
     * Optimistic-concurrency token (migration 0236). A save that carries a token is applied only if
     * the stored row still holds it; otherwise the write is refused with 409 instead of silently
     * overwriting a colleague's marks.
     */
    version: z.number().int().positive().optional(),
    /**
     * Moderation adjustment (migration 0237). Added to `marksObtained` for the effective score; the
     * raw mark is never rewritten, so the original result stays auditable. Only a moderation action
     * may change it, never a bulk marks save.
     */
    graceMarks: z.number().nonnegative().max(MAX_GRACE_MARKS).optional(),
    moderationReason: z.string().nullable().optional(),
    moderatedBy: z.string().nullable().optional(),
    moderatedAt: z.string().nullable().optional(),
    /** Server-set: user who entered the marks. */
    markedBy: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

/**
 * Public marks projection for audiences that cannot grade.
 *
 * The staff endpoint strips `markedBy`, the OCC `version` and every moderation note before it
 * returns a row; this is the documented shape of that projection (numeric grace stays, because it
 * is part of the effective score the printed card shows). A future self-service endpoint must reuse
 * this schema instead of the full record.
 */
export const examResultPublicSchema = z
  .object({
    id: z.string(),
    examId: z.string(),
    studentId: z.string(),
    marksObtained: z.number().nonnegative(),
    graceMarks: z.number().nonnegative().optional(),
  })
  .strict();
export type ExamResultPublic = z.infer<typeof examResultPublicSchema>;

export const examResultRecordInsertSchema = z
  .object({
    id: z.string().optional(),
    examId: z.string().min(1, "Exam ID is required"),
    studentId: z.string().min(1, "Student ID is required"),
    marksObtained: z.number().nonnegative().max(MAX_MARKS_OBTAINED).default(0),
    version: z.number().int().positive().optional(),
  })
  .strict();

export const examResultRecordUpdateSchema = examResultRecordInsertSchema.partial().strict();

/**
 * Marks-save write body: only the fields a marking action may set.
 *
 * The full record schema used to be the body, so the contract advertised `graceMarks`,
 * `moderationReason` and `moderatedBy` on a plain marks save (the persist happened to ignore
 * them). `marksObtained` is required here — a missing value must not default to a zero mark.
 */
export const examMarksWriteSchema = z
  .object({
    id: z.string(),
    examId: z.string().min(1),
    studentId: z.string().min(1),
    marksObtained: z.number().nonnegative().max(MAX_MARKS_OBTAINED),
    version: z.number().int().positive().optional(),
  })
  .strict();

export const examMarksWriteListSchema = z.array(examMarksWriteSchema).max(2000);
export type ExamMarksWrite = z.infer<typeof examMarksWriteSchema>;

export type ExamResult = z.infer<typeof examResultRecordSchema>;
export type ExamResultInsert = z.infer<typeof examResultRecordInsertSchema>;
export type ExamResultUpdate = z.infer<typeof examResultRecordUpdateSchema>;
/**
 * Largest accepted marks batch: one class roster is at most a few hundred rows, so 2000 covers a
 * whole session sitting while keeping the single INSERT … ON CONFLICT transaction bounded.
 */
export const examResultListSchema = z.array(examResultRecordSchema).max(2000);

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
    // Examinations capture the operator's deletion reason: an archived exam removes marks from
    // every report, so the audit row must say why.
    captureDeletionReason: true,
    retentionDays: null,
  },
  permissions: {
    // Own-module permissions. These used to point at `students.*`, so every examination handler
    // required a *students* grant and revoking it silently removed exam access.
    read: "examinations.read",
    write: "examinations.write",
    delete: "examinations.delete",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    // Export/report reads are plain examination reads — not student-module grants.
    export: "examinations.read",
    reports: "examinations.read",
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
