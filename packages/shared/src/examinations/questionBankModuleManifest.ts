import { z } from "zod";
import type { Permission } from "../auth/permissions.js";

export const questionDifficultySchema = z.enum(["easy", "medium", "hard"]);
export const questionTypeSchema = z.enum([
  "mcq",
  "true_false",
  "short",
  "fill_blank",
  "matching",
  "numeric",
  "ordering",
]);

export const questionSourceReferenceSchema = z.object({
  bookName: z.string().optional(),
  series: z.string().optional(),
  bookVolume: z.string().optional(),
  volumePart: z.string().optional(),
  edition: z.string().optional(),
  isbn: z.string().optional(),
  author: z.string().optional(),
  editor: z.string().optional(),
  translator: z.string().optional(),
  publisher: z.string().optional(),
  cityOfPublication: z.string().optional(),
  publishDate: z.string().optional(),
  yearHijri: z.string().optional(),
  language: z.string().optional(),
  chapter: z.string().optional(),
  pageNumber: z.string().optional(),
  paragraph: z.string().optional(),
  footnote: z.string().optional(),
  surah: z.string().optional(),
  ayah: z.string().optional(),
  juz: z.string().optional(),
  hizb: z.string().optional(),
  hadithCollection: z.string().optional(),
  hadithNumber: z.string().optional(),
  manuscript: z.string().optional(),
  catalogNumber: z.string().optional(),
  quote: z.string().optional(),
  notes: z.string().optional(),
});

export const questionBookCitationSchema = z.object({
  bookId: z.string(),
  citation: questionSourceReferenceSchema.partial(),
});

export const questionBankQuestionRecordSchema = z
  .object({
    id: z.string(),
    categoryIds: z.array(z.string()),
    categoryId: z.string().optional(),
    type: questionTypeSchema,
    difficulty: questionDifficultySchema,
    questionLanguage: z.enum(["en", "ar", "ur", "fa"]),
    text: z.string(),
    options: z.array(z.string()),
    answer: z.string(),
    marks: z.number().optional(),
    tags: z.array(z.string()).optional(),
    sourceCitations: z.array(questionBookCitationSchema).optional(),
    sources: z.array(questionSourceReferenceSchema).optional(),
    source: questionSourceReferenceSchema.optional(),
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

export const questionBankQuestionInsertSchema = z
  .object({
    id: z.string().optional(),
    categoryIds: z.array(z.string()).min(1),
    type: questionTypeSchema,
    difficulty: questionDifficultySchema,
    questionLanguage: z.enum(["en", "ar", "ur", "fa"]).default("en"),
    text: z.string().min(1),
    options: z.array(z.string()).default([]),
    answer: z.string(),
    marks: z.number().optional().default(1),
    tags: z.array(z.string()).optional(),
    sourceCitations: z.array(questionBookCitationSchema).optional(),
  })
  .strict();

export const questionBankQuestionUpdateSchema = questionBankQuestionInsertSchema.partial().strict();

export type QuestionBankQuestionInsert = z.infer<typeof questionBankQuestionInsertSchema>;
export type QuestionBankQuestionUpdate = z.infer<typeof questionBankQuestionUpdateSchema>;
export const questionBankQuestionListSchema = z.array(questionBankQuestionRecordSchema);

export function isQuestionDeleted(question: { deletedAt?: string | null }): boolean {
  return Boolean(question.deletedAt);
}

export function filterActiveQuestions<T extends { deletedAt?: string | null }>(
  questions: T[],
): T[] {
  return questions.filter((q) => !isQuestionDeleted(q));
}

/**
 * Strict single-question write schema (FE form + BE write boundary).
 * Omits server-owned soft-delete and deprecated legacy fields; `message` values
 * are translation keys resolved via `mapZodFormErrors`.
 */
export const questionBankQuestionWriteSchema = z
  .object({
    id: z.string(),
    categoryIds: z
      .array(z.string())
      .min(1, { message: "questionBank.validation.categoryRequired" }),
    type: questionTypeSchema,
    difficulty: questionDifficultySchema,
    questionLanguage: z.enum(["en", "ar", "ur", "fa"]),
    text: z.string().min(1, { message: "questionBank.validation.textRequired" }),
    options: z.array(z.string()),
    answer: z.string(),
    sourceCitations: z.array(questionBookCitationSchema).optional(),
  })
  .strict()
  .superRefine((question, ctx) => {
    if (question.type === "mcq") {
      if (!question.answer || !question.options.includes(question.answer)) {
        ctx.addIssue({
          code: "custom",
          path: ["answer"],
          message: "questionBank.validation.answerFromChoices",
        });
      }
    } else if (question.type === "true_false") {
      if (!question.answer) {
        ctx.addIssue({
          code: "custom",
          path: ["answer"],
          message: "questionBank.validation.trueFalseRequired",
        });
      }
    }
  });

export const questionBankTestRecordSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    categoryId: z.string().nullable(),
    questionIds: z.array(z.string()),
    difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
    duration: z.number(),
    createdAt: z.string(),
    updatedAt: z.string().optional(),
    examClass: z.string().optional(),
    /** `session_classes.id`; `examClass` is the display snapshot. */
    classId: z.string().nullable().optional(),
    totalMarks: z.number().optional(),
    instructions: z.string().optional(),
    sections: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          instructions: z.string(),
          questionIds: z.array(z.string()),
        }),
      )
      .optional(),
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
  })
  .strict();

export const questionBankTestInsertSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    categoryId: z.string().nullable().optional(),
    questionIds: z.array(z.string()).default([]),
    difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
    duration: z.number().default(60),
    examClass: z.string().optional(),
    /** `session_classes.id`; `examClass` is the display snapshot. */
    classId: z.string().nullable().optional(),
    totalMarks: z.number().optional(),
    instructions: z.string().optional(),
    sections: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          instructions: z.string(),
          questionIds: z.array(z.string()),
        }),
      )
      .optional(),
  })
  .strict();

export const questionBankTestUpdateSchema = questionBankTestInsertSchema.partial().strict();

export type QuestionBankTestInsert = z.infer<typeof questionBankTestInsertSchema>;
export type QuestionBankTestUpdate = z.infer<typeof questionBankTestUpdateSchema>;
export const questionBankTestListSchema = z.array(questionBankTestRecordSchema);

export const questionBankResultRecordSchema = z
  .object({
    id: z.string(),
    testId: z.string(),
    studentId: z.string(),
    studentName: z.string(),
    submittedAt: z.string(),
    answers: z.record(z.string(), z.string()).default({}),
    scores: z.record(z.string(), z.number()).default({}),
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const questionBankResultInsertSchema = z
  .object({
    id: z.string().optional(),
    testId: z.string(),
    studentId: z.string(),
    studentName: z.string().default(""),
    submittedAt: z.string(),
    answers: z.record(z.string(), z.string()).default({}),
    scores: z.record(z.string(), z.number()).default({}),
  })
  .strict();

export const questionBankResultUpdateSchema = questionBankResultInsertSchema.partial().strict();

export type QuestionBankResultInsert = z.infer<typeof questionBankResultInsertSchema>;
export type QuestionBankResultUpdate = z.infer<typeof questionBankResultUpdateSchema>;
export const questionBankResultListSchema = z.array(questionBankResultRecordSchema);

/**
 * Question Bank module manifest — soft-delete on questions (JSONB); tests/results upsert-only.
 */
export const QUESTION_BANK_MODULE_MANIFEST = {
  moduleId: "questionBank",
  entityType: "QuestionBankQuestion",
  collectionKey: "questions",
  testsCollectionKey: "tests",
  resultsCollectionKey: "assessment_results",
  settingsObjectKey: "question_bank_settings",
  columnPreferencesObjectKey: "question_bank_user_column_preferences",
  restBasePath: "/api/question-bank",
  analyticsCategory: "questionBank",
  tiers: ["work", "reports", "setup"] as const,
  setupSubTabs: ["preferences"] as const,
  /** Questions soft-delete via JSONB; tests/papers and assessment_results are upsert-only (no trash UI). */
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
    directoryViews: ["questions", "generate"] as const,
    bulkActions: ["delete"] as const,
  },
  defaultPageSize: 15,
  maxPageSize: 100,
} as const;

export type QuestionBankModuleTier = (typeof QUESTION_BANK_MODULE_MANIFEST.tiers)[number];
