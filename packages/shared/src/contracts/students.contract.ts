import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { studentRecordSchema } from "../students/studentsModuleManifest.js";
import { widgetAggregateResultSchema } from "../schemas/common.dto.js";
import { studentLookupPutBodySchema } from "../schemas/studentLookup.dto.js";
import {
  studentListPageResponseSchema,
  studentWrappedResponseSchema,
  studentBulkResultResponseSchema,
  studentPreferencesResponseSchema,
  studentLookupsResponseSchema,
  studentCrudRoutes,
  studentCrudContract,
  studentOperationRoutes,
  studentOperationsContract,
} from "./students.contract.routes.js";

export {
  studentListPageResponseSchema,
  studentWrappedResponseSchema,
  studentBulkResultResponseSchema,
  studentPreferencesResponseSchema,
  studentLookupsResponseSchema,
  studentCrudRoutes,
  studentCrudContract,
  studentOperationRoutes,
  studentOperationsContract,
};

const c = initContract();

const errorResponse = z.unknown();

export const studentContract = c.router({
  ...studentCrudRoutes,
  ...studentOperationRoutes,
  restore: {
    method: "POST",
    path: "/api/students/:id/restore",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true), student: studentRecordSchema }),
      // Restore conflicts (GR, Student ID, contact) are answered as 400 validation errors.
      400: errorResponse,
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
      // Per-row restore conflicts are reported in `conflicts`; a whole-request conflict can 400.
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk restore students",
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
  // `GET /api/students/lookups/:kind` was declared here but never registered (only `GET /lookups`
  // and `PUT /lookups/:kind` exist), so a generated client could call a route that 404s. Removed
  // rather than registered: the bulk `GET /lookups` map is the only consumer surface.
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
