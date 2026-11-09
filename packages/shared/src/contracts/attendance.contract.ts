import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { attendanceDeletionReasonSchema } from "../schemas/attendance.dto.js";
import {
  attendanceBulkIdsSchema,
  attendanceBulkRestoreIdsSchema,
  attendanceCreateSchema,
  attendanceUpdateSchema,
} from "../schemas/attendance.dto.js";
import {
  attendanceRecordSchema,
  attendanceBulkSchema,
} from "../attendance/attendanceModuleManifest.js";
import {
  attendanceLookupsMapSchema,
  attendanceLookupPutBodySchema,
  attendanceStatusSchema,
} from "../attendance/attendanceLookupTypes.js";
import {
  attendanceFieldConfigPutBodySchema,
  attendancePreferencesPutBodySchema,
} from "../attendance/attendanceSetupConfigTypes.js";
import {
  attendanceListPageResponseSchema,
  attendancePreferencesResponseSchema,
  errorResponse,
} from "./attendance.contractSchemas.js";
import { attendanceLifecycleRoutes } from "./attendance.contractLeaves.js";
import { attendanceMatrixRoutes } from "./attendance.contractMatrix.js";
import { attendanceMatrixExportRoutes } from "./attendance.contractExport.js";
import { attendanceCheckInRoutes } from "./attendance.contractCheckIns.js";
import { attendanceAnalyticsRoutes } from "./attendance.contractAnalytics.js";
import {
  attendanceBatchRejectionSchema,
  attendanceIdPathParamsSchema,
  attendanceKindPathParamsSchema,
  attendanceListQuerySchema,
  attendanceReasonHeaderSchema,
} from "../attendance/attendanceApiSchemas.js";
import { attendanceEscalationRoutes } from "./attendance.contractEscalation.js";

export {
  attendanceDaySubmissionResponseSchema,
  attendanceListPageResponseSchema,
  attendancePreferencesResponseSchema,
} from "./attendance.contractSchemas.js";

const c = initContract();

const bulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

export const attendanceContract = c.router({
  // Roster-day submission, excuse lifecycle and absence escalation (own modules for the 300-line band).
  ...attendanceLifecycleRoutes,
  ...attendanceEscalationRoutes,
  ...attendanceMatrixRoutes,
  ...attendanceMatrixExportRoutes,
  ...attendanceCheckInRoutes,
  ...attendanceAnalyticsRoutes,
  list: {
    method: "GET",
    path: "/api/attendance",
    query: attendanceListQuerySchema,
    responses: {
      200: attendanceListPageResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List attendance records",
  },
  create: {
    method: "POST",
    path: "/api/attendance",
    body: attendanceCreateSchema,
    headers: attendanceReasonHeaderSchema,
    responses: {
      200: attendanceRecordSchema,
      201: attendanceRecordSchema,
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      422: errorResponse,
      500: errorResponse,
    },
    summary: "Create a new attendance record",
  },
  bulk: {
    method: "PUT",
    path: "/api/attendance/bulk",
    body: attendanceBulkSchema,
    headers: attendanceReasonHeaderSchema,
    responses: {
      200: z.object({ records: z.array(attendanceRecordSchema) }),
      400: errorResponse,
      403: errorResponse,
      409: attendanceBatchRejectionSchema,
      413: errorResponse,
      422: attendanceBatchRejectionSchema,
      500: errorResponse,
    },
    summary: "Bulk upsert attendance records",
  },
  bulkDelete: {
    method: "POST",
    path: "/api/attendance/bulk-delete",
    body: attendanceBulkIdsSchema,
    headers: attendanceReasonHeaderSchema,
    responses: {
      200: bulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk soft-delete attendance records",
  },
  bulkRestore: {
    method: "POST",
    path: "/api/attendance/bulk-restore",
    body: attendanceBulkRestoreIdsSchema,
    responses: {
      200: bulkResultResponseSchema,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk restore attendance records",
  },
  update: {
    method: "PUT",
    path: "/api/attendance/:id",
    pathParams: attendanceIdPathParamsSchema,
    body: attendanceUpdateSchema,
    headers: attendanceReasonHeaderSchema,
    responses: {
      200: z.object({ record: attendanceRecordSchema }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      422: errorResponse,
      500: errorResponse,
    },
    summary: "Update an attendance record by ID",
  },
  delete: {
    method: "DELETE",
    path: "/api/attendance/:id",
    pathParams: attendanceIdPathParamsSchema,
    body: z.object({ deletionReason: attendanceDeletionReasonSchema }).strict(),
    headers: attendanceReasonHeaderSchema,
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Soft delete an attendance record by ID",
  },
  restore: {
    method: "POST",
    path: "/api/attendance/:id/restore",
    pathParams: attendanceIdPathParamsSchema,
    body: z.object({}).optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a soft-deleted attendance record by ID",
  },
  getFieldConfig: {
    method: "GET",
    path: "/api/attendance/field-config",
    responses: {
      200: z.object({ config: z.record(z.string(), z.unknown()).nullable() }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get field config",
  },
  updateFieldConfig: {
    method: "PUT",
    path: "/api/attendance/field-config",
    body: attendanceFieldConfigPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), config: z.record(z.string(), z.unknown()) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update field config",
  },
  getPreferences: {
    method: "GET",
    path: "/api/attendance/preferences",
    responses: {
      200: z.object({ preferences: attendancePreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/attendance/preferences",
    body: attendancePreferencesPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), preferences: attendancePreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update preferences",
  },
  getLookups: {
    method: "GET",
    path: "/api/attendance/lookups",
    responses: {
      200: z.object({ lookups: attendanceLookupsMapSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get all lookups",
  },
  getLookupKind: {
    method: "GET",
    path: "/api/attendance/lookups/:kind",
    pathParams: attendanceKindPathParamsSchema,
    responses: {
      200: z.array(attendanceStatusSchema),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get a specific lookup kind",
  },
  updateLookupKind: {
    method: "PUT",
    path: "/api/attendance/lookups/:kind",
    pathParams: attendanceKindPathParamsSchema,
    body: attendanceLookupPutBodySchema,
    responses: {
      200: z.object({
        success: z.literal(true),
        kind: z.string(),
        items: attendanceLookupPutBodySchema.shape.items,
      }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Replace a specific lookup kind",
  },
});
