import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  enrollmentRecordSchema,
  enrollmentRecordInsertSchema,
  enrollmentRecordUpdateSchema,
} from "../enrollmentsModuleManifest.js";
import { enrollmentsListQuerySchema } from "../enrollmentsListQuery.js";
import { enrollmentsReportAggregatesSchema } from "../enrollmentsReportAggregates.js";
import { reportComparisonQuerySchema } from "../reportComparisonQuery.js";
import { bulkStringIdsBodySchema } from "../apiSchemas.js";
import { widgetAggregatesBodySchema } from "../schemas/common.dto.js";

const c = initContract();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();

/** Envelope for paginated enrollment list responses (`EnrollmentsListPageResult`). */
export const enrollmentListPageResponseSchema = z.object({
  enrollments: z.array(enrollmentRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
const enrollmentBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

/** Normalized Enrollments Setup preferences (`EnrollmentModulePreferences`). */
export const enrollmentPreferencesResponseSchema = z.object({
  maxStudentsPerClass: z.string(),
  waitlistEnabled: z.boolean(),
  requireEligibilityCheck: z.boolean(),
  autoAssignClass: z.boolean(),
  enrollmentApproval: z.boolean(),
  allowTransfers: z.boolean(),
  dropDeadlineDays: z.string(),
  reenrollmentReminder: z.boolean(),
  defaultViewLayout: z.string(),
});

const enrollmentWidgetAggregateResultSchema = z.object({
  value: z.number(),
  totalCount: z.number(),
  chartData: z.array(z.object({ name: z.string(), value: z.number() })),
});

export const enrollmentContract = c.router({
  list: {
    method: "GET",
    path: "/api/enrollments",
    query: enrollmentsListQuerySchema,
    responses: { 200: enrollmentListPageResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "List enrollments",
  },
  get: {
    method: "GET",
    path: "/api/enrollments/:id",
    query: z
      .object({
        includeDeleted: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
      })
      .optional(),
    responses: {
      200: enrollmentRecordSchema,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Get a single enrollment",
  },
  create: {
    method: "POST",
    path: "/api/enrollments",
    body: enrollmentRecordInsertSchema,
    responses: {
      201: enrollmentRecordSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Create an enrollment",
  },
  update: {
    method: "PUT",
    path: "/api/enrollments/:id",
    body: enrollmentRecordUpdateSchema,
    responses: {
      200: enrollmentRecordSchema,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Update an enrollment",
  },
  delete: {
    method: "DELETE",
    path: "/api/enrollments/:id",
    body: z.object({ deletionReason: z.string().optional() }).optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Soft delete an enrollment",
  },
  bulkDelete: {
    method: "POST",
    path: "/api/enrollments/bulk-delete",
    body: bulkStringIdsBodySchema,
    responses: { 200: enrollmentBulkResultResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "Bulk soft-delete enrollments",
  },
  bulkRestore: {
    method: "POST",
    path: "/api/enrollments/bulk-restore",
    body: bulkStringIdsBodySchema,
    responses: { 200: enrollmentBulkResultResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "Bulk restore enrollments",
  },
  restore: {
    method: "POST",
    path: "/api/enrollments/:id/restore",
    body: z.object({}).optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Restore an enrollment",
  },
  exportAudit: {
    method: "POST",
    path: "/api/enrollments/export-audit",
    body: z.object({}).optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Export audit log",
  },
  widgetAggregates: {
    method: "POST",
    path: "/api/enrollments/widget-aggregates",
    body: widgetAggregatesBodySchema,
    responses: {
      200: z.object({ results: z.record(z.string(), enrollmentWidgetAggregateResultSchema) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Widget aggregates",
  },
  reportAggregates: {
    method: "GET",
    path: "/api/enrollments/report-aggregates",
    query: reportComparisonQuerySchema.optional(),
    responses: {
      200: enrollmentsReportAggregatesSchema,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Report aggregates",
  },

  getFieldConfig: {
    method: "GET",
    path: "/api/enrollments/field-config",
    responses: {
      200: z.object({ config: z.record(z.string(), z.unknown()).nullable() }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get field config",
  },
  updateFieldConfig: {
    method: "PUT",
    path: "/api/enrollments/field-config",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true), config: z.record(z.string(), z.unknown()) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update field config",
  },
  getPreferences: {
    method: "GET",
    path: "/api/enrollments/preferences",
    responses: {
      200: z.object({ preferences: enrollmentPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/enrollments/preferences",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true), preferences: enrollmentPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update preferences",
  },
  getLookups: {
    method: "GET",
    path: "/api/enrollments/lookups",
    responses: { 200: z.unknown(), 403: errorResponse, 500: errorResponse },
    summary: "Get all lookups",
  },
  getLookupKind: {
    method: "GET",
    path: "/api/enrollments/lookups/:kind",
    responses: { 200: z.unknown(), 403: errorResponse, 500: errorResponse },
    summary: "Get a specific lookup kind",
  },
});
