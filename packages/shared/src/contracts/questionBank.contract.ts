import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { widgetAggregatesBodySchema, widgetAggregateResultSchema } from "../schemas/common.dto.js";
import {
  questionBankQuestionListSchema,
  questionBankQuestionRecordSchema,
  questionBankResultListSchema,
  questionBankResultRecordSchema,
  questionBankTestListSchema,
  questionBankTestRecordSchema,
} from "../examinations/questionBankModuleManifest.js";
import {
  questionBankQuestionClientSchema,
  questionBankQuestionSummarySchema,
} from "../examinations/questionBankSerialization.js";
import {
  questionBankQuestionsQuerySchema,
  questionBankPagedCollectionQuerySchema,
  questionBankPickerQuerySchema,
  questionIdParamsSchema,
} from "../examinations/questionBankListQuery.js";
import {
  questionBankFieldConfigPutBodySchema,
  questionBankPreferencesPutBodySchema,
  questionBankPreferencesResponseSchema,
} from "../examinations/questionBankSetupConfigTypes.js";
import {
  questionBankReportAggregatesSchema,
  questionBankReportQuerySchema,
} from "../examinations/questionBankReportAggregates.js";
import {
  questionBankActionRoutes,
  questionDomainResponseStatuses,
} from "./questionBankActionRoutes.js";

const c = initContract();
const ok = z.unknown();
const bulkIds = z
  .object({
    ids: z.array(z.string().trim().min(1).max(128)).min(1).max(500),
    deletionReason: z.string().max(500).optional(),
  })
  .strict();

/** Envelope for paginated question list responses. */
export const questionBankQuestionsPageResponseSchema = z
  .object({
    questions: z.array(questionBankQuestionClientSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    hasMore: z.boolean(),
  })
  .strict();

/** Picker response: summaries only, always paginated. */
export const questionBankPickerResponseSchema = z.object({
  questions: z.array(questionBankQuestionSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
const questionBankBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

/** Normalized Setup config payload (QuestionBankSettings / preferences slice). */
const questionBankConfigResponseSchema = z.record(z.string(), z.unknown());

export const questionBankContract = c.router({
  listQuestions: {
    method: "GET",
    path: "/api/question-bank/questions",
    query: questionBankQuestionsQuerySchema,
    responses: {
      200: z.union([
        // Both branches are strict so the union picks the right shape instead of stripping the
        // pagination fields as "extra keys".
        z.object({ questions: z.array(questionBankQuestionClientSchema) }).strict(),
        questionBankQuestionsPageResponseSchema,
      ]),
      403: ok,
      500: ok,
    },
    summary: "List questions",
  },
  pickerQuestions: {
    method: "GET",
    path: "/api/question-bank/questions/picker",
    query: questionBankPickerQuerySchema,
    responses: {
      200: questionBankPickerResponseSchema,
      400: ok,
      403: ok,
      500: ok,
    },
    summary: "Paginated, answer-key-free question picker",
  },
  bulkDeleteQuestions: {
    method: "POST",
    path: "/api/question-bank/questions/bulk-delete",
    body: bulkIds,
    responses: {
      200: questionBankBulkResultResponseSchema,
      ...questionDomainResponseStatuses,
    },
    summary: "Bulk soft-delete questions",
  },
  bulkRestoreQuestions: {
    method: "POST",
    path: "/api/question-bank/questions/bulk-restore",
    body: bulkIds,
    responses: {
      200: questionBankBulkResultResponseSchema,
      ...questionDomainResponseStatuses,
    },
    summary: "Bulk restore questions",
  },
  listTests: {
    method: "GET",
    path: "/api/question-bank/tests",
    query: questionBankPagedCollectionQuerySchema,
    responses: {
      200: z.object({ tests: z.array(questionBankTestRecordSchema) }),
      400: ok,
      403: ok,
      500: ok,
    },
    summary: "List tests",
  },
  listResults: {
    method: "GET",
    path: "/api/question-bank/assessment-results",
    query: questionBankPagedCollectionQuerySchema,
    responses: {
      200: z.object({ results: z.array(questionBankResultRecordSchema) }),
      400: ok,
      403: ok,
      500: ok,
    },
    summary: "List assessment results",
  },
  bulkUpdateQuestions: {
    method: "PUT",
    path: "/api/question-bank/questions/bulk",
    body: questionBankQuestionListSchema,
    responses: {
      200: z.object({ questions: z.array(questionBankQuestionRecordSchema) }),
      ...questionDomainResponseStatuses,
    },
    summary: "Bulk update questions",
  },
  bulkUpdateTests: {
    method: "PUT",
    path: "/api/question-bank/tests/bulk",
    body: questionBankTestListSchema,
    responses: {
      200: z.object({ tests: z.array(questionBankTestRecordSchema) }),
      ...questionDomainResponseStatuses,
    },
    summary: "Bulk update tests",
  },
  bulkUpdateResults: {
    method: "PUT",
    path: "/api/question-bank/assessment-results/bulk",
    body: questionBankResultListSchema,
    responses: {
      200: z.object({ results: z.array(questionBankResultRecordSchema) }),
      ...questionDomainResponseStatuses,
    },
    summary: "Bulk update assessment results",
  },
  deleteQuestion: {
    method: "DELETE",
    path: "/api/question-bank/questions/:id",
    pathParams: questionIdParamsSchema,
    body: ok,
    responses: {
      200: z.object({ success: z.literal(true) }),
      ...questionDomainResponseStatuses,
    },
    summary: "Delete question",
  },
  restoreQuestion: {
    method: "POST",
    path: "/api/question-bank/questions/:id/restore",
    pathParams: questionIdParamsSchema,
    body: ok,
    responses: {
      200: z.object({ success: z.literal(true) }),
      ...questionDomainResponseStatuses,
    },
    summary: "Restore question",
  },
  ...questionBankActionRoutes,
  reportAggregates: {
    method: "GET",
    path: "/api/question-bank/report-aggregates",
    query: questionBankReportQuerySchema.strict().optional(),
    responses: { 200: questionBankReportAggregatesSchema, 403: ok, 500: ok },
    summary: "Get question bank report aggregates",
  },
  widgetAggregates: {
    method: "POST",
    path: "/api/question-bank/widget-aggregates",
    body: widgetAggregatesBodySchema,
    responses: {
      200: z.record(z.string(), widgetAggregateResultSchema),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get widget aggregates",
  },
  getFieldConfig: {
    method: "GET",
    path: "/api/question-bank/config/fields",
    responses: { 200: questionBankConfigResponseSchema, 403: ok, 500: ok },
    summary: "Get field config",
  },
  updateFieldConfig: {
    method: "PUT",
    path: "/api/question-bank/config/fields",
    body: questionBankFieldConfigPutBodySchema,
    responses: { 200: questionBankConfigResponseSchema, 403: ok, 500: ok },
    summary: "Update field config",
  },
  getPreferences: {
    method: "GET",
    path: "/api/question-bank/config/preferences",
    responses: { 200: questionBankPreferencesResponseSchema, 403: ok, 500: ok },
    summary: "Get preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/question-bank/config/preferences",
    body: questionBankPreferencesPutBodySchema,
    responses: { 200: questionBankPreferencesResponseSchema, 403: ok, 500: ok },
    summary: "Update preferences",
  },
  getComposedConfig: {
    method: "GET",
    path: "/api/question-bank/config/composed",
    responses: { 200: questionBankConfigResponseSchema, 403: ok, 500: ok },
    summary: "Get composed config",
  },
});

export type QuestionBankContract = typeof questionBankContract;
