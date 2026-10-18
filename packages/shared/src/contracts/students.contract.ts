import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  studentWireWriteSchema,
  studentsBulkEnrollBodySchema,
  studentsDuplicateCheckBodySchema,
  studentsBulkStatusSchema,
} from "../schemas/students.dto.js";
import { studentRecordSchema } from "../students/studentsModuleManifest.js";
import {
  studentsListQuerySchema,
  studentsNextGrNumberQuerySchema,
} from "../students/studentsListQuery.js";
import { includeDeletedQuerySchema } from "../core/apiSchemas.js";
import { widgetAggregateResultSchema } from "../schemas/common.dto.js";
import { studentLookupPutBodySchema } from "../schemas/studentLookup.dto.js";

const c = initContract();

const errorResponse = z.unknown();

/** Envelope for paginated student list responses (`StudentsListPageResult`). */
export const studentListPageResponseSchema = z.object({
  students: z.array(studentRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});

/** `{ student }` envelope returned by get/create/update. */
export const studentWrappedResponseSchema = z.object({ student: studentRecordSchema });

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
export const studentBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

/** Normalized Students Setup GR / auto-id preferences (`StudentModulePreferences`). */
export const studentPreferencesResponseSchema = z.object({
  autoGenerateId: z.boolean(),
  grNumberTemplate: z.string(),
  grNumberDigits: z.number(),
  grNumberRestartAnnually: z.boolean(),
});

/** Students Setup string-list lookups (`StudentLookupsMap`). */
export const studentLookupsResponseSchema = z.object({
  statuses: z.array(z.string()),
  genderFilters: z.array(z.string()),
  discountTypes: z.array(z.string()),
});

export const studentCrudRoutes = {
  list: {
    method: "GET",
    path: "/api/students",
    query: studentsListQuerySchema,
    responses: {
      200: studentListPageResponseSchema,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List students",
  },
  create: {
    method: "POST",
    path: "/api/students",
    body: studentWireWriteSchema,
    responses: {
      200: z.object({ student: studentRecordSchema }),
      201: z.object({ student: studentRecordSchema }),
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Create a new student",
  },
  get: {
    method: "GET",
    path: "/api/students/:id",
    query: includeDeletedQuerySchema.optional(),
    responses: {
      200: z.object({ student: studentRecordSchema }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Get a single student",
  },
  update: {
    method: "PUT",
    path: "/api/students/:id",
    body: studentWireWriteSchema,
    responses: {
      200: z.object({ student: studentRecordSchema }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Update a student",
  },
  delete: {
    method: "DELETE",
    path: "/api/students/:id",
    body: z.object({ deletionReason: z.string().optional() }).optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Soft delete a student",
  },
} as const;

export const studentCrudContract = c.router(studentCrudRoutes);

export const studentOperationRoutes = {
  bulkStatus: {
    method: "POST",
    path: "/api/students/bulk-status",
    body: studentsBulkStatusSchema,
    responses: {
      200: studentBulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk update student status",
  },
  bulkEnroll: {
    method: "POST",
    path: "/api/students/bulk-enroll",
    body: studentsBulkEnrollBodySchema,
    responses: {
      200: studentBulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk enroll students",
  },
  nextGrNumber: {
    method: "GET",
    path: "/api/students/next-gr-number",
    query: studentsNextGrNumberQuerySchema,
    responses: {
      200: z.object({ grNumber: z.string() }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get next available GR number",
  },
  duplicateCheck: {
    method: "POST",
    path: "/api/students/duplicate-check",
    body: studentsDuplicateCheckBodySchema,
    responses: {
      200: z.object({
        reason: z.enum(["contact", "email", "nameDob", "grNumber"]).nullable(),
      }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Check for duplicate students",
  },
  migrateGrNumbers: {
    method: "POST",
    path: "/api/students/migrate-gr-numbers",
    body: z.unknown(),
    responses: {
      200: z.object({
        success: z.literal(true),
        updated: z.number(),
        hasMore: z.boolean().optional(),
      }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Migrate GR numbers",
  },
} as const;

export const studentOperationsContract = c.router(studentOperationRoutes);

export const studentContract = c.router({
  ...studentCrudRoutes,
  ...studentOperationRoutes,
  restore: {
    method: "POST",
    path: "/api/students/:id/restore",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true), student: studentRecordSchema }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a soft-deleted student",
  },
  bulkDelete: {
    method: "POST",
    path: "/api/students/bulk-delete",
    body: z.object({
      ids: z.array(z.union([z.string(), z.number()])),
      deletionReason: z.string().optional(),
    }),
    responses: {
      200: studentBulkResultResponseSchema,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk delete students",
  },
  bulkRestore: {
    method: "POST",
    path: "/api/students/bulk-restore",
    body: z.object({ ids: z.array(z.union([z.string(), z.number()])) }),
    responses: {
      200: z.object({
        success: z.literal(true),
        succeeded: z.number(),
        failed: z.number(),
        conflicts: z.array(
          z.object({
            id: z.string(),
            errors: z.array(z.object({ field: z.string(), message: z.string() })),
          }),
        ),
      }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk restore students",
  },
  exportAudit: {
    method: "POST",
    path: "/api/students/export-audit",
    body: z.object({ count: z.number(), scope: z.enum(["all", "filtered", "selection"]) }),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Log export audit",
  },
  setupAudit: {
    method: "POST",
    path: "/api/students/setup-audit",
    body: z.object({ area: z.enum(["fields", "preferences"]), summary: z.string() }),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Log setup audit",
  },
  resolve: {
    method: "POST",
    path: "/api/students/resolve",
    body: z.object({ ids: z.array(z.string()) }),
    responses: {
      200: z.object({ students: z.array(studentRecordSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Resolve students by IDs",
  },
  linkedContactIds: {
    method: "GET",
    path: "/api/students/linked-contact-ids",
    query: z.object({ excludeId: z.string().optional() }).optional(),
    responses: {
      200: z.object({ contactIds: z.array(z.union([z.string(), z.number()])) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get linked contact IDs",
  },
  widgetAggregates: {
    method: "POST",
    path: "/api/students/widget-aggregates",
    body: z.object({ widgets: z.array(z.unknown()) }),
    responses: {
      200: z.object({ results: z.record(z.string(), widgetAggregateResultSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get widget aggregates",
  },

  getFieldConfig: {
    method: "GET",
    path: "/api/students/field-config",
    responses: {
      200: z.object({ config: z.record(z.string(), z.unknown()).nullable() }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get field config",
  },
  updateFieldConfig: {
    method: "PUT",
    path: "/api/students/field-config",
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
    path: "/api/students/preferences",
    responses: {
      200: z.object({ preferences: studentPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/students/preferences",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true), preferences: studentPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update preferences",
  },
  getLookups: {
    method: "GET",
    path: "/api/students/lookups",
    responses: {
      200: z.object({ lookups: studentLookupsResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get all lookups",
  },
  getLookupKind: {
    method: "GET",
    path: "/api/students/lookups/:kind",
    responses: { 200: z.unknown(), 403: errorResponse, 500: errorResponse },
    summary: "Get a specific lookup kind",
  },
  updateLookupKind: {
    method: "PUT",
    path: "/api/students/lookups/:kind",
    pathParams: z.object({ kind: z.string() }),
    body: studentLookupPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), kind: z.string(), items: z.array(z.string()) }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Replace a specific lookup kind",
  },
});
