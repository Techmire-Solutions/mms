import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { errorResponse } from "./attendance.contractSchemas.js";
import { attendanceIdPathParamsSchema } from "../attendance/attendanceApiSchemas.js";

/**
 * Chronic-absence escalation routes (migration 0221).
 *
 * Extracted so `attendance.contract.ts` stays inside the 300-line band; merged back into the same
 * router, so route keys and the implementation mapping are unchanged.
 */

export const absenceAlertSchema = z
  .object({
    id: z.string(),
    classId: z.string(),
    studentId: z.string(),
    streakStart: isoDateSchema,
    streakEnd: isoDateSchema,
    streakLength: z.number().int(),
    threshold: z.number().int(),
    status: z.enum(["open", "resolved", "dismissed"]),
    notifiedAt: z.string().nullable(),
    resolvedAt: z.string().nullable(),
    resolvedBy: z.string().nullable(),
    resolutionNote: z.string().nullable(),
  })
  .strict();

export const absenceAlertListQuerySchema = z
  .object({
    status: z.enum(["open", "resolved", "dismissed"]).optional(),
    studentId: z.string().trim().max(64).optional(),
    classId: z.string().trim().max(64).optional(),
  })
  .strict();

export const absenceAlertResolveSchema = z
  .object({
    status: z.enum(["resolved", "dismissed"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const absenceScanResultSchema = z
  .object({
    studentsScanned: z.number().int(),
    streaksFound: z.number().int(),
    alertsRaised: z.number().int(),
    alertsUpdated: z.number().int(),
  })
  .strict();

/** Queued-job envelope shared with the CSV routes. */
export const attendanceJobEnvelopeSchema = z
  .object({
    job: z
      .object({
        id: z.string(),
        moduleId: z.string(),
        kind: z.string(),
        status: z.string(),
        label: z.string(),
      })
      .passthrough(),
  })
  .strict();

export const attendanceEscalationRoutes = {
  listAbsenceAlerts: {
    method: "GET",
    path: "/api/attendance/absence-alerts",
    query: absenceAlertListQuerySchema,
    responses: {
      200: z.object({ alerts: z.array(absenceAlertSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List chronic-absence alerts",
  },
  scanAbsenceStreaks: {
    method: "POST",
    path: "/api/attendance/absence-alerts/scan",
    body: z.object({}).optional(),
    responses: {
      /** The scan runs as a background job: 202 + the queued job record. */
      202: attendanceJobEnvelopeSchema,
      403: errorResponse,
      503: errorResponse,
      500: errorResponse,
    },
    summary: "Queue a chronic-absence scan for this workspace",
  },
  resolveAbsenceAlert: {
    method: "POST",
    path: "/api/attendance/absence-alerts/:id/resolve",
    pathParams: attendanceIdPathParamsSchema,
    body: absenceAlertResolveSchema,
    responses: {
      200: absenceAlertSchema,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Resolve or dismiss a chronic-absence alert",
  },
} as const;
