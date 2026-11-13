import { z } from "zod";
import type { Permission } from "../auth/permissions.js";
import { validateQuestionByType } from "./questionInvariants.js";
import { QUESTION_STATUSES } from "./questionLifecycle.js";
import {
  questionDifficultySchema,
  questionLanguageSchema,
  questionTypeSchema,
  type QuestionType,
} from "./questionTaxonomy.js";

export {
  questionDifficultySchema,
  questionLanguageSchema,
  questionStatusSchema,
  questionTypeSchema,
} from "./questionTaxonomy.js";

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

export const questionAttachmentSchema = z
  .object({
    id: z.string(),
    kind: z.enum(["stem", "option"]),
    optionIndex: z.number().int().nonnegative().nullable(),
    name: z.string(),
    mime: z.string(),
    size: z.number().int().nonnegative(),
    url: z.string(),
    sortOrder: z.number().int().nonnegative(),
  })
  .strict();

export const questionBankQuestionRecordSchema = z
  .object({
    id: z.string(),
    categoryIds: z.array(z.string()),
    categoryId: z.string().optional(),
    type: questionTypeSchema,
    difficulty: questionDifficultySchema,
    questionLanguage: questionLanguageSchema,
    text: z.string(),
    options: z.array(z.string()),
    answer: z.string(),
    marks: z.number().int().optional(),
    tags: z.array(z.string()).optional(),
    sourceCitations: z.array(questionBookCitationSchema).optional(),
    attachments: z.array(questionAttachmentSchema).optional(),
    sources: z.array(questionSourceReferenceSchema).optional(),
    source: questionSourceReferenceSchema.optional(),
    /** OCC token (0240); omitted means "no token supplied" — legacy last-write-wins. */
    version: z.number().int().positive().optional(),
    /** Computed on list/picker reads (papers referencing the question); never stored. */
    usageCount: z.number().int().nonnegative().optional(),
    /** Authoring lifecycle (0241); server-owned, never accepted from the generic bulk write. */
    status: z.enum(QUESTION_STATUSES).optional(),
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
    questionLanguage: questionLanguageSchema.default("en"),
    text: z.string().min(1),
    options: z.array(z.string()).default([]),
    answer: z.string(),
    marks: z.number().int().nonnegative().optional().default(1),
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
 * Strict single-question write schema (FE form + BE write boundary), discriminated by `type`.
 *
 * The branches exist so `z.infer` narrows on the discriminant; the semantic rules still come from
 * `validateQuestionByType`, the one engine shared with the bulk write plan and the API.
 */
const questionWriteBase = {
  id: z.string(),
  categoryIds: z.array(z.string()),
  difficulty: questionDifficultySchema,
  questionLanguage: questionLanguageSchema,
  text: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
  sourceCitations: z.array(questionBookCitationSchema).optional(),
  /** OCC token echoed from the record being edited (0240). */
  version: z.number().int().positive().optional(),
};

const questionWriteBranch = <T extends QuestionType>(type: T) =>
  z.object({ ...questionWriteBase, type: z.literal(type) }).strict();

export const questionBankQuestionWriteSchema = z
  .discriminatedUnion("type", [
    questionWriteBranch("mcq"),
    questionWriteBranch("true_false"),
    questionWriteBranch("short"),
    questionWriteBranch("fill_blank"),
    questionWriteBranch("matching"),
    questionWriteBranch("numeric"),
    questionWriteBranch("ordering"),
  ])
  .superRefine((question, ctx) => {
    for (const issue of validateQuestionByType(question)) {
      ctx.addIssue({ code: "custom", path: issue.path, message: issue.messageKey });
    }
  });

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
    // Module-owned keys: mapping to `students.*` made the gate read the Students grant.
    read: "questionBank.read",
    write: "questionBank.write",
    // Trash/restore stays author-level; approval and master-key export use `questionBank.delete`.
    delete: "questionBank.write",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    export: "questionBank.delete",
    reports: "questionBank.read",
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ["questions", "generate"] as const,
    bulkActions: ["delete"] as const,
  },
  defaultPageSize: 15,
  maxPageSize: 100,
} as const;

export type QuestionBankModuleTier = (typeof QUESTION_BANK_MODULE_MANIFEST.tiers)[number];

export {
  questionBankResultInsertSchema,
  questionBankResultListSchema,
  questionBankResultRecordSchema,
  questionBankResultUpdateSchema,
  questionBankTestInsertSchema,
  questionBankTestListSchema,
  questionBankTestRecordSchema,
  questionBankTestUpdateSchema,
} from "./questionBankTestSchemas.js";
export type {
  QuestionBankResultInsert,
  QuestionBankResultUpdate,
  QuestionBankTestInsert,
  QuestionBankTestUpdate,
} from "./questionBankTestSchemas.js";
