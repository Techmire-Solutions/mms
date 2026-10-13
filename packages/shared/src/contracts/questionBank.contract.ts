import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { baseListQuerySchema } from "../core/apiSchemas.js";
import { widgetAggregatesBodySchema, widgetAggregateResultSchema } from "../schemas/common.dto.js";
import {
  questionBankQuestionRecordSchema,
  questionBankTestRecordSchema,
  questionBankResultRecordSchema,
} from "../examinations/questionBankModuleManifest.js";
import {
  questionBankReportAggregatesSchema,
  questionBankReportQuerySchema,
} from "../examinations/questionBankReportAggregates.js";

const c = initContract();
const ok = z.unknown();
const bulkIds = z.object({ ids: z.array(z.string()), deletionReason: z.string().optional() });

/** Envelope for paginated question list responses. */
export const questionBankQuestionsPageResponseSchema = z.object({
  questions: z.array(questionBankQuestionRecordSchema),
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
    query: baseListQuerySchema,
    responses: {
      200: z.union([
        z.object({ questions: z.array(questionBankQuestionRecordSchema) }),
        questionBankQuestionsPageResponseSchema,
      ]),
      403: ok,
      500: ok,
    },
    summary: "List questions",
  },
  bulkDeleteQuestions: {
    method: "POST",
    path: "/api/question-bank/questions/bulk-delete",
    body: bulkIds,
    responses: { 200: questionBankBulkResultResponseSchema, 403: ok, 500: ok },
    summary: "Bulk soft-delete questions",
  },
  bulkRestoreQuestions: {
    method: "POST",
    path: "/api/question-bank/questions/bulk-restore",
    body: bulkIds,
    responses: { 200: questionBankBulkResultResponseSchema, 403: ok, 500: ok },
    summary: "Bulk restore questions",
  },
  listTests: {
    method: "GET",
    path: "/api/question-bank/tests",
    query: z.object({}).optional(),
    responses: {
      200: z.object({ tests: z.array(questionBankTestRecordSchema) }),
      403: ok,
      500: ok,
    },
    summary: "List tests",
  },
  listResults: {
    method: "GET",
    path: "/api/question-bank/assessment-results",
    query: z.object({}).optional(),
    responses: {
      200: z.object({ results: z.array(questionBankResultRecordSchema) }),
      403: ok,
      500: ok,
    },
    summary: "List assessment results",
  },
  bulkUpdateQuestions: {
    method: "PUT",
    path: "/api/question-bank/questions/bulk",
    body: ok,
    responses: {
      200: z.object({ questions: z.array(questionBankQuestionRecordSchema) }),
      403: ok,
      500: ok,
    },
    summary: "Bulk update questions",
  },
  bulkUpdateTests: {
    method: "PUT",
    path: "/api/question-bank/tests/bulk",
    body: ok,
    responses: {
      200: z.object({ tests: z.array(questionBankTestRecordSchema) }),
      403: ok,
      500: ok,
    },
    summary: "Bulk update tests",
  },
  bulkUpdateResults: {
    method: "PUT",
    path: "/api/question-bank/assessment-results/bulk",
    body: ok,
    responses: {
      200: z.object({ results: z.array(questionBankResultRecordSchema) }),
      403: ok,
      500: ok,
    },
    summary: "Bulk update assessment results",
  },
  deleteQuestion: {
    method: "DELETE",
    path: "/api/question-bank/questions/:id",
    body: ok,
    responses: { 200: z.object({ success: z.literal(true) }), 403: ok, 500: ok },
    summary: "Delete question",
  },
  restoreQuestion: {
    method: "POST",
    path: "/api/question-bank/questions/:id/restore",
    body: ok,
    responses: { 200: z.object({ success: z.literal(true) }), 403: ok, 500: ok },
    summary: "Restore question",
  },
  reportAggregates: {
    method: "GET",
    path: "/api/question-bank/report-aggregates",
    query: questionBankReportQuerySchema.optional(),
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
    body: ok,
    responses: { 200: questionBankConfigResponseSchema, 403: ok, 500: ok },
    summary: "Update field config",
  },
  getPreferences: {
    method: "GET",
    path: "/api/question-bank/config/preferences",
    responses: { 200: questionBankConfigResponseSchema, 403: ok, 500: ok },
    summary: "Get preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/question-bank/config/preferences",
    body: ok,
    responses: { 200: questionBankConfigResponseSchema, 403: ok, 500: ok },
    summary: "Update preferences",
  },
  getComposedConfig: {
    method: "GET",
    path: "/api/question-bank/config/composed",
    responses: { 200: questionBankConfigResponseSchema, 403: ok, 500: ok },
    summary: "Get composed config",
  },
});
