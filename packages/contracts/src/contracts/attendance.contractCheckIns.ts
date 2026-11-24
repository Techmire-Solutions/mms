import { z } from "zod";
import { attendanceRecordSchema } from "../attendance/attendanceModuleManifest.js";
import {
  attendanceCheckInBodySchema,
  attendanceCheckInRejectionSchema,
} from "../attendance/attendanceApiSchemas.js";
import { errorResponse } from "./attendance.contractSchemas.js";

/**
 * Device check-in ingestion route (RFID / biometric / turnstile batches).
 *
 * One batch, one atomic write for the accepted rows, and a row-level report for everything that was
 * rejected or already present (a replayed batch is `duplicate`, not an error).
 */
export const attendanceCheckInResponseSchema = z
  .object({
    accepted: z.number().int(),
    duplicates: z.number().int(),
    rejected: z.array(attendanceCheckInRejectionSchema),
    records: z.array(attendanceRecordSchema),
  })
  .strict();

export const attendanceCheckInRoutes = {
  ingestCheckIns: {
    method: "POST",
    path: "/api/attendance/check-ins",
    body: attendanceCheckInBodySchema,
    responses: {
      200: attendanceCheckInResponseSchema,
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      413: errorResponse,
      500: errorResponse,
    },
    summary: "Ingest a device check-in batch (idempotent per student/day)",
  },
} as const;
