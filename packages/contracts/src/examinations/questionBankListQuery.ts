import { z } from "zod";
import { baseListQueryFields } from "../core/apiSchemas.js";
import { QUESTION_STATUSES } from "./questionLifecycle.js";
import { questionTypeSchema } from "./questionBankModuleManifest.js";
import type { QuestionBankQuestion } from "./questionBankEntities.js";

/** Maximum number of ids accepted in a comma-separated filter. */
export const QUESTION_QUERY_MAX_IDS = 20;

/** Maximum length of one id inside a comma-separated filter. */
export const QUESTION_QUERY_ID_MAX_LENGTH = 64;

const csvIdsSchema = z
  .string()
  .max(QUESTION_QUERY_MAX_IDS * (QUESTION_QUERY_ID_MAX_LENGTH + 1))
  .refine(
    (value) =>
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean).length <= QUESTION_QUERY_MAX_IDS,
    { message: `At most ${QUESTION_QUERY_MAX_IDS} ids are accepted` },
  );

const difficultyListSchema = z
  .string()
  .max(40)
  .regex(/^(easy|medium|hard)(,(easy|medium|hard)){0,2}$/, {
    message: "difficulty must be a comma-separated list of easy, medium, hard",
  });

/** Sort fields the list endpoint understands (`usageCount` is a computed column). */
export const QUESTION_LIST_SORT_FIELDS = [
  "text",
  "difficulty",
  "type",
  "questionLanguage",
  "updatedAt",
  "createdAt",
  "usageCount",
] as const;

/**
 * Query accepted by `GET /api/question-bank/questions`.
 *
 * Strict by design: the previous schema was `.passthrough()`, so `categoryId`/`difficulty` reached
 * the repository as unbounded free strings and unknown keys were silently ignored.
 */
export const questionBankQuestionsQuerySchema = z
  .object(baseListQueryFields)
  .extend({
    /** Comma-separated category ids (junction match on `question_categories`). */
    categoryId: csvIdsSchema.optional(),
    difficulty: difficultyListSchema.optional(),
    status: z.enum(QUESTION_STATUSES).optional(),
    /** Exact tag match against `question_tags`. */
    tag: z.string().trim().max(64).optional(),
    /** Minimum number of papers that reference a question (correlated count). */
    minUsage: z.coerce.number().int().min(0).max(1_000_000).optional(),
    sortField: z.enum(QUESTION_LIST_SORT_FIELDS).optional(),
    afterId: z.string().trim().max(128).optional(),
  })
  .strict();

/** Query accepted by the paper-builder picker (`GET /questions/picker`). */
export const questionBankPickerQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().max(500).optional(),
    categoryId: csvIdsSchema.optional(),
    difficulty: difficultyListSchema.optional(),
    type: questionTypeSchema.optional(),
    tag: z.string().trim().max(64).optional(),
    afterId: z.string().trim().max(128).optional(),
  })
  .strict();

/** Paged query for the paper (tests) and result collections. */
export const questionBankPagedCollectionQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    includeDeleted: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  })
  .strict();

/** Path params for every `/:id` Question Bank route. */
export const questionIdParamsSchema = z.object({ id: z.string().trim().min(1).max(128) }).strict();

/** Path params for attachment routes. */
export const questionAttachmentParamsSchema = questionIdParamsSchema
  .extend({ attachmentId: z.string().trim().min(1).max(128) })
  .strict();

/** Query accepted by the question bank questions list endpoint. */
export interface QuestionBankListQuery {
  page?: number;
  limit?: number;
  search?: string;
  /** Comma-separated category ids (junction match on `question_categories`). */
  categoryId?: string;
  /** Comma-separated difficulties (`easy|medium|hard`). */
  difficulty?: string;
  status?: (typeof QUESTION_STATUSES)[number];
  type?: string;
  tag?: string;
  minUsage?: number;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  includeDeleted?: boolean;
  afterId?: string;
}

/** Paginated question bank questions response. */
export interface QuestionBankListPageResult {
  questions: QuestionBankQuestion[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
