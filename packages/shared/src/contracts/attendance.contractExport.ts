import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import {
  ATTENDANCE_MATRIX_MAX_DAYS,
  ATTENDANCE_MATRIX_MAX_CELLS,
} from "../attendance/attendanceMatrix.js";
import { attendanceJobEnvelopeSchema } from "./attendance.contractEscalation.js";
import { errorResponse } from "./attendance.contractSchemas.js";

/**
 * Register / monthly-matrix export route.
 *
 * Runs as a background job (the matrix streams; XLSX is capped) and answers 202 with the job record,
 * exactly like the record-list CSV export.
 */

export const attendanceMatrixExportBodySchema = z
  .object({
    classId: z.string().trim().min(1).max(100),
    sectionId: z.string().trim().max(100).optional(),
    dateFrom: isoDateSchema,
    dateTo: isoDateSchema,
    format: z.enum(["csv", "xlsx"]).default("csv"),
  })
  .strict()
  .refine((body) => body.dateFrom <= body.dateTo, {
    message: "dateFrom must not be after dateTo",
    path: ["dateTo"],
  });

export const attendanceMatrixExportRoutes = {
  exportMatrix: {
    method: "POST",
    path: "/api/attendance/export/matrix",
    body: attendanceMatrixExportBodySchema,
    responses: {
      202: attendanceJobEnvelopeSchema,
      400: errorResponse,
      403: errorResponse,
      413: errorResponse,
      503: errorResponse,
      500: errorResponse,
    },
    summary: `Queue an attendance register (max ${ATTENDANCE_MATRIX_MAX_DAYS} days, ${ATTENDANCE_MATRIX_MAX_CELLS} cells for XLSX)`,
  },
} as const;
