import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { baseListQuerySchema, softDeleteBodySchema } from "../core/apiSchemas.js";
import {
  examRecordSchema,
  examResultRecordSchema,
  examListSchema,
  examResultListSchema,
} from "../examinations/examinationsModuleManifest.js";
import { examinationsReportAggregatesSchema } from "../examinations/examinationsReportAggregates.js";
import { reportComparisonQuerySchema } from "../reports/reportComparisonQuery.js";
import { widgetAggregatesBodySchema } from "../schemas/common.dto.js";
import {
  examinationsFieldConfigPutBodySchema,
  examinationsPreferencesPutBodySchema,
} from "../examinations/examinationsSetupConfigTypes.js";

const c = initContract();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const ok = z.unknown();
const bulkIds = z.object({ ids: z.array(z.string()), deletionReason: z.string().optional() });

/** Envelope for paginated exam list responses. */
export const examsPageResponseSchema = z.object({
  exams: z.array(examRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
const examinationBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

/** Normalized Examinations Setup preferences (`ExaminationsModulePreferences`). */
export const examinationsPreferencesResponseSchema = z.object({
  passMark: z.string(),
  maxMark: z.string(),
  gradingSystem: z.string(),
  showRankings: z.boolean(),
  allowRetake: z.boolean(),
  autoPublishResults: z.boolean(),
  notifyOnResult: z.boolean(),
  certificateTemplate: z.string(),
  aiGrading: z.boolean(),
  distinguishHonours: z.boolean(),
  examReminders: z.boolean(),
  defaultViewLayout: z.string(),
});

const examinationsWidgetAggregateResultSchema = z.object({
  value: z.number(),
  totalCount: z.number(),
  chartData: z.array(z.object({ name: z.string(), value: z.number() })),
});

export const examinationContract = c.router({
  listExams: {
    method: "GET",
    path: "/api/examinations/exams",
    query: baseListQuerySchema,
    responses: {
      200: z.union([z.object({ exams: z.array(examRecordSchema) }), examsPageResponseSchema]),
      403: ok,
      500: ok,
    },
    summary: "List exams",
  },
  bulkDeleteExams: {
    method: "POST",
    path: "/api/examinations/exams/bulk-delete",
    body: bulkIds,
    responses: { 200: examinationBulkResultResponseSchema, 403: ok, 500: ok },
    summary: "Bulk soft-delete exams",
  },
  bulkRestoreExams: {
    method: "POST",
    path: "/api/examinations/exams/bulk-restore",
    body: bulkIds,
    responses: { 200: examinationBulkResultResponseSchema, 403: ok, 500: ok },
    summary: "Bulk restore exams",
  },
  listResults: {
    method: "GET",
    path: "/api/examinations/results",
    query: z.object({}).optional(),
    responses: { 200: z.array(examResultRecordSchema), 403: ok, 500: ok },
    summary: "List exam results",
  },
  bulkUpdateExams: {
    method: "PUT",
    path: "/api/examinations/exams/bulk",
    body: examListSchema,
    responses: { 200: z.object({ exams: z.array(examRecordSchema) }), 403: ok, 500: ok },
    summary: "Bulk upsert exams",
  },
  bulkUpdateResults: {
    method: "PUT",
    path: "/api/examinations/results/bulk",
    body: examResultListSchema,
    responses: { 200: z.object({ results: z.array(examResultRecordSchema) }), 403: ok, 500: ok },
    summary: "Bulk upsert exam results",
  },
  deleteExam: {
    method: "DELETE",
    path: "/api/examinations/exams/:id",
    body: softDeleteBodySchema.optional(),
    responses: { 200: z.object({ success: z.literal(true) }), 403: ok, 500: ok },
    summary: "Soft delete an exam",
  },
  restoreExam: {
    method: "POST",
    path: "/api/examinations/exams/:id/restore",
    body: z.object({}).optional(),
    responses: { 200: z.object({ success: z.literal(true) }), 403: ok, 500: ok },
    summary: "Restore a soft deleted exam",
  },
  widgetAggregates: {
    method: "POST",
    path: "/api/examinations/widget-aggregates",
    body: widgetAggregatesBodySchema,
    responses: {
      200: z.record(z.string(), examinationsWidgetAggregateResultSchema),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get widget aggregates",
  },
  reportAggregates: {
    method: "GET",
    path: "/api/examinations/report-aggregates",
    query: reportComparisonQuerySchema.optional(),
    responses: { 200: examinationsReportAggregatesSchema, 403: errorResponse, 500: errorResponse },
    summary: "Get report aggregates",
  },

  getFieldConfig: {
    method: "GET",
    path: "/api/examinations/field-config",
    responses: {
      200: z.object({ config: z.record(z.string(), z.unknown()).nullable() }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get field config",
  },
  updateFieldConfig: {
    method: "PUT",
    path: "/api/examinations/field-config",
    body: examinationsFieldConfigPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), config: z.record(z.string(), z.unknown()) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update field config",
  },
  getPreferences: {
    method: "GET",
    path: "/api/examinations/preferences",
    responses: {
      200: z.object({ preferences: examinationsPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/examinations/preferences",
    body: examinationsPreferencesPutBodySchema,
    responses: {
      200: z.object({
        success: z.literal(true),
        preferences: examinationsPreferencesResponseSchema,
      }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update preferences",
  },
  getLookups: {
    method: "GET",
    path: "/api/examinations/lookups",
    responses: { 200: z.unknown(), 403: errorResponse, 500: errorResponse },
    summary: "Get all lookups",
  },
  getLookupKind: {
    method: "GET",
    path: "/api/examinations/lookups/:kind",
    responses: { 200: z.unknown(), 403: errorResponse, 500: errorResponse },
    summary: "Get a specific lookup kind",
  },
});
