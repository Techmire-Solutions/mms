import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { softDeleteBodySchema, includeDeletedQuerySchema } from "../core/apiSchemas.js";
import {
  sessionCreateBodySchema,
  sessionUpdateBodySchema,
  sessionsBulkIdsSchema,
} from "../schemas/sessions.dto.js";
import { widgetAggregatesBodySchema } from "../schemas/common.dto.js";
import { sessionsBulkStatusSchema } from "../sessions/sessionsModuleManifest.js";
import { sessionsReportAggregatesSchema } from "../sessions/sessionsReportAggregates.js";
import { academicTerminologySchema } from "../sessions/academicTerminology.js";
import { sessionsListQuerySchema } from "../sessions/sessionsListQuery.js";
import {
  sessionErrorResponseSchema,
  sessionIdParamsSchema,
  sessionReadErrors,
  sessionResponseSchema,
  sessionWriteErrors,
} from "./sessionContractShared.js";
import { sessionLookupContractEndpoints } from "./sessions.contract.lookups.js";

const c = initContract();
const errorResponse = sessionErrorResponseSchema;

/** `x-expected-*` optimistic-concurrency tokens, validated at the HTTP boundary. */
export const sessionOccHeadersSchema = z
  .object({
    "x-expected-version": z
      .string()
      .regex(/^\d+$/, "x-expected-version must be a positive integer")
      .optional(),
    "x-expected-updated-at": z
      .string()
      .datetime({ offset: true, message: "x-expected-updated-at must be an ISO-8601 timestamp" })
      .optional(),
  })
  .passthrough();

/** Envelope for paginated session list responses (`SessionsListPageResult`). */
export const sessionListPageResponseSchema = z.object({
  sessions: z.array(sessionResponseSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  hasMore: z.boolean(),
  /** Present when the caller paged with `afterId`; feed it back as the next `afterId`. */
  nextCursor: z.string().optional(),
});

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
const sessionBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

/** Normalized Sessions Setup preferences (`SessionModulePreferences`). */
export const sessionPreferencesResponseSchema = z.object({
  defaultDuration: z.string(),
  defaultSessionType: z.string(),
  allowOverlap: z.boolean(),
  archiveOldSessions: z.boolean(),
  requireBudget: z.boolean(),
  timetableConflictCheck: z.boolean(),
  notifyOnSessionStart: z.boolean(),
  academicYear: z.string(),
  sessionStart: z.string(),
  defaultViewLayout: z.string(),
  terminology: academicTerminologySchema,
});

/** Bounded field-config body (up to 200 keys, each ≤100 chars). */
export const sessionFieldConfigBodySchema = z
  .record(z.string().max(100), z.unknown())
  .refine((value) => Object.keys(value).length <= 200, "At most 200 field-config keys");

/** Preferences patch; unknown keys are stripped and the service normalizes defaults. */
export const sessionPreferencesBodySchema = sessionPreferencesResponseSchema.partial();

export const sessionContract = c.router({
  list: {
    method: "GET",
    path: "/api/sessions",
    query: sessionsListQuerySchema,
    responses: {
      200: sessionListPageResponseSchema,
      ...sessionReadErrors,
    },
    summary: "List sessions (summary or full rows; offset or id-keyset paging)",
  },
  create: {
    method: "POST",
    path: "/api/sessions",
    body: sessionCreateBodySchema,
    responses: {
      201: z.object({ session: sessionResponseSchema }),
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      /** Overlaps a live session (no-overlap guarantee, migration 0206). */
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Create a session",
  },
  bulkDelete: {
    method: "POST",
    path: "/api/sessions/bulk-delete",
    body: sessionsBulkIdsSchema,
    responses: {
      200: sessionBulkResultResponseSchema,
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk soft-delete sessions",
  },
  bulkStatus: {
    method: "POST",
    path: "/api/sessions/bulk-status",
    body: sessionsBulkStatusSchema,
    responses: {
      200: sessionBulkResultResponseSchema,
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk update session status",
  },
  bulkRestore: {
    method: "POST",
    path: "/api/sessions/bulk-restore",
    body: sessionsBulkIdsSchema,
    responses: {
      200: sessionBulkResultResponseSchema,
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk restore sessions",
  },
  get: {
    method: "GET",
    path: "/api/sessions/:id",
    pathParams: sessionIdParamsSchema,
    query: includeDeletedQuerySchema.optional(),
    responses: {
      200: z.object({ session: sessionResponseSchema }),
      ...sessionReadErrors,
    },
    summary: "Get a single session",
  },
  update: {
    method: "PUT",
    path: "/api/sessions/:id",
    pathParams: sessionIdParamsSchema,
    headers: sessionOccHeadersSchema,
    body: sessionUpdateBodySchema,
    responses: {
      200: z.object({ session: sessionResponseSchema }),
      ...sessionWriteErrors,
      /** Stale OCC token or an overlapping date range. */
      409: errorResponse,
      /** No `x-expected-version` / `x-expected-updated-at` token: conditional update required. */
      428: errorResponse,
    },
    summary: "Update session",
  },
  delete: {
    method: "DELETE",
    path: "/api/sessions/:id",
    pathParams: sessionIdParamsSchema,
    body: softDeleteBodySchema.optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
      /** The session is not in a terminal state (complete/cancel it first, or override). */
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Delete session",
  },
  restore: {
    method: "POST",
    path: "/api/sessions/:id/restore",
    pathParams: sessionIdParamsSchema,
    body: z.object({}).optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Restore session",
  },
  widgetAggregates: {
    method: "POST",
    path: "/api/sessions/widget-aggregates",
    body: widgetAggregatesBodySchema,
    responses: {
      200: z.object({
        results: z.record(
          z.string(),
          z.object({
            value: z.number(),
            totalCount: z.number(),
            chartData: z.array(z.object({ name: z.string(), value: z.number() })),
          }),
        ),
      }),
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Widget aggregates",
  },
  reportAggregates: {
    method: "GET",
    path: "/api/sessions/report-aggregates",
    responses: {
      200: sessionsReportAggregatesSchema,
      401: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Report aggregates",
  },

  getFieldConfig: {
    method: "GET",
    path: "/api/sessions/field-config",
    responses: {
      200: z.object({ config: z.record(z.string(), z.unknown()).nullable() }),
      401: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get field config",
  },
  updateFieldConfig: {
    method: "PUT",
    path: "/api/sessions/field-config",
    body: sessionFieldConfigBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), config: z.record(z.string(), z.unknown()) }),
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update field config",
  },
  getPreferences: {
    method: "GET",
    path: "/api/sessions/preferences",
    responses: {
      200: z.object({ preferences: sessionPreferencesResponseSchema }),
      401: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/sessions/preferences",
    body: sessionPreferencesBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), preferences: sessionPreferencesResponseSchema }),
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update preferences",
  },
  ...sessionLookupContractEndpoints,
});
