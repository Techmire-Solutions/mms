import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { apiErrorResponseSchema } from "../schemas/api.dto.js";
import { widgetAggregateResultSchema, widgetQuerySchema } from "../schemas/common.dto.js";
import { studentLookupPutBodySchema } from "../schemas/studentLookup.dto.js";
import { moduleFieldsPrefsAuditBodySchema } from "../schemas/csvExport.dto.js";
import {
  studentFieldConfigPutBodySchema,
  studentPreferencesPutBodySchema,
} from "../students/studentSetupConfigTypes.js";
import {
  studentsListQuerySchema,
  studentListPageResponseSchema,
  studentWrappedResponseSchema,
  studentBulkResultResponseSchema,
  studentPreferencesResponseSchema,
  studentLookupsResponseSchema,
  studentResponseRecordSchema,
  studentCrudRoutes,
  studentCrudContract,
  studentOperationRoutes,
  studentOperationsContract,
} from "./students.contract.routes.js";

export {
  apiErrorResponseSchema,
  studentsListQuerySchema,
  studentListPageResponseSchema,
  studentWrappedResponseSchema,
  studentBulkResultResponseSchema,
  studentPreferencesResponseSchema,
  studentLookupsResponseSchema,
  studentResponseRecordSchema,
  studentCrudRoutes,
  studentCrudContract,
  studentOperationRoutes,
  studentOperationsContract,
};

const c = initContract();

const errorResponse = apiErrorResponseSchema;

/** Soft-delete, single restore, and bulk trash student contract routes. */
export const studentSoftDeleteRoutes = {
  restore: {
    method: "POST" as const,
    path: "/api/students/:id/restore",
    body: z.object({}).optional(),
    responses: {
      200: z.object({ success: z.literal(true), student: studentResponseRecordSchema }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a soft-deleted student",
  },
  bulkDelete: {
    method: "POST" as const,
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
    method: "POST" as const,
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
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk restore students",
  },
} as const;

export const studentSoftDeleteContract = c.router(studentSoftDeleteRoutes);

/** Setup field configuration, preferences, and lookups routes. */
export const studentSetupRoutes = {
  setupAudit: {
    method: "POST" as const,
    path: "/api/students/setup-audit",
    body: moduleFieldsPrefsAuditBodySchema,
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Log setup audit",
  },
  getFieldConfig: {
    method: "GET" as const,
    path: "/api/students/field-config",
    responses: {
      200: z.object({ config: z.record(z.string(), z.unknown()).nullable() }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get field config",
  },
  updateFieldConfig: {
    method: "PUT" as const,
    path: "/api/students/field-config",
    body: studentFieldConfigPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), config: z.record(z.string(), z.unknown()) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update field config",
  },
  getPreferences: {
    method: "GET" as const,
    path: "/api/students/preferences",
    responses: {
      200: z.object({ preferences: studentPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get preferences",
  },
  updatePreferences: {
    method: "PUT" as const,
    path: "/api/students/preferences",
    body: studentPreferencesPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), preferences: studentPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update preferences",
  },
  getLookups: {
    method: "GET" as const,
    path: "/api/students/lookups",
    responses: {
      200: z.object({ lookups: studentLookupsResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get all lookups",
  },
  updateLookupKind: {
    method: "PUT" as const,
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
} as const;

export const studentSetupContract = c.router(studentSetupRoutes);

/** Aggregate queries, linked contacts, and metric reporting routes. */
export const studentAggregateRoutes = {
  resolve: {
    method: "POST" as const,
    path: "/api/students/resolve",
    body: z.object({ ids: z.array(z.string()) }),
    responses: {
      200: z.object({ students: z.array(studentResponseRecordSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Resolve students by IDs",
  },
  linkedContactIds: {
    method: "GET" as const,
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
    method: "POST" as const,
    path: "/api/students/widget-aggregates",
    body: z.object({ widgets: z.array(widgetQuerySchema) }),
    responses: {
      200: z.object({ results: z.record(z.string(), widgetAggregateResultSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get widget aggregates",
  },
} as const;

export const studentAggregateContract = c.router(studentAggregateRoutes);

/** Combined Students module contract. */
export const studentContract = c.router({
  ...studentCrudRoutes,
  ...studentOperationRoutes,
  ...studentSoftDeleteRoutes,
  ...studentSetupRoutes,
  ...studentAggregateRoutes,
});
