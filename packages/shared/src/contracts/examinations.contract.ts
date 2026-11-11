import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { softDeleteBodySchema } from "../core/apiSchemas.js";
import { bulkStringIdsBodySchema, resourceIdParamsSchema } from "../schemas/api.dto.js";
import {
  examRecordSchema,
  examResultRecordSchema,
  examResultsPageResponseSchema,
  examBulkWriteSchema,
  examMarksWriteListSchema,
} from "../examinations/examinationsModuleManifest.js";
import {
  examsListQuerySchema,
  examsListResponseSchema,
} from "../examinations/examinationsListQuery.js";
import { examinationsPreferencesSchema } from "../examinations/examinationsSetupPreferences.js";
import { examMarksImportBodySchema } from "../schemas/opsModuleImport.dto.js";
import { examinationsReportAggregatesSchema } from "../examinations/examinationsReportAggregates.js";
import { reportComparisonQuerySchema } from "../reports/reportComparisonQuery.js";
import { widgetAggregatesBodySchema } from "../schemas/common.dto.js";
import {
  examinationsFieldConfigPutBodySchema,
  examinationsPreferencesPutBodySchema,
} from "../examinations/examinationsSetupConfigTypes.js";

const c = initContract();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
/** 202 envelope for queued examination jobs (marks import / broadsheet export). */
const examJobAcceptedResponseSchema = z.object({
  job: z
    .object({
      id: z.string(),
      moduleId: z.string(),
      kind: z.string(),
      status: z.enum(["pending", "running", "completed", "failed"]),
      label: z.string(),
      hasDownload: z.boolean().optional(),
      progress: z.object({ current: z.number(), total: z.number() }).optional(),
      error: z.string().optional(),
      completedAt: z.string().optional(),
      createdAt: z.string(),
    })
    .strict(),
});
/** Capped at 500 ids and 500-char reason, matching the shared bulk schema and the DB column. */
const bulkIds = bulkStringIdsBodySchema;

/** Marks query: optional server-side filters plus keyset pagination. */
export const examResultsListQuerySchema = z
  .object({
    examId: z.string().trim().min(1).max(128).optional(),
    studentId: z.string().trim().min(1).max(64).optional(),
    /** Keyset cursor: the last `id` of the previous page. */
    cursor: z.string().trim().min(1).max(128).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
const examinationBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

const examinationsWidgetAggregateResultSchema = z.object({
  value: z.number(),
  totalCount: z.number(),
  chartData: z.array(z.object({ name: z.string(), value: z.number() })),
});

import { examinationEligibilityRoutes } from "./examinations.contractEligibility.js";

export const examinationContract = c.router({
  // Attendance gate, audited overrides and results finalisation (own module, 300-line band).
  ...examinationEligibilityRoutes,
  listExams: {
    method: "GET",
    path: "/api/examinations/exams",
    query: examsListQuerySchema,
    responses: {
      200: examsListResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List exams",
  },
  bulkDeleteExams: {
    method: "POST",
    path: "/api/examinations/exams/bulk-delete",
    body: bulkIds,
    responses: { 200: examinationBulkResultResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "Bulk soft-delete exams",
  },
  bulkRestoreExams: {
    method: "POST",
    path: "/api/examinations/exams/bulk-restore",
    body: bulkIds,
    responses: { 200: examinationBulkResultResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "Bulk restore exams",
  },
  listResults: {
    method: "GET",
    path: "/api/examinations/results",
    query: examResultsListQuerySchema,
    responses: { 200: examResultsPageResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "List exam results (filterable, keyset-paginated)",
  },
  bulkUpdateExams: {
    method: "PUT",
    path: "/api/examinations/exams/bulk",
    body: examBulkWriteSchema,
    responses: {
      200: z.object({ exams: z.array(examRecordSchema) }),
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk upsert exams",
  },
  bulkUpdateResults: {
    method: "PUT",
    path: "/api/examinations/results/bulk",
    body: examMarksWriteListSchema,
    responses: {
      200: z.object({ results: z.array(examResultRecordSchema) }),
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk upsert exam results",
  },
  deleteExam: {
    method: "DELETE",
    path: "/api/examinations/exams/:id",
    pathParams: resourceIdParamsSchema,
    body: softDeleteBodySchema.optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Soft delete an exam",
  },
  restoreExam: {
    method: "POST",
    path: "/api/examinations/exams/:id/restore",
    pathParams: resourceIdParamsSchema,
    body: z.object({}).optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a soft deleted exam",
  },
  importExamMarks: {
    method: "POST",
    path: "/api/examinations/exams/:id/results/import",
    pathParams: resourceIdParamsSchema,
    body: examMarksImportBodySchema,
    responses: {
      202: examJobAcceptedResponseSchema,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
      503: errorResponse,
    },
    summary: "Queue a marks import for one exam",
  },
  exportExamResults: {
    method: "POST",
    path: "/api/examinations/exams/:id/results/export",
    pathParams: resourceIdParamsSchema,
    body: z.object({}).optional(),
    responses: {
      202: examJobAcceptedResponseSchema,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
      503: errorResponse,
    },
    summary: "Queue a broadsheet export for one exam (published-only for non-graders)",
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
      200: z.object({ preferences: examinationsPreferencesSchema }),
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
        preferences: examinationsPreferencesSchema,
      }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update preferences",
  },
});
