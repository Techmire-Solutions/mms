import { z } from "zod";
import { attendanceRecordSchema } from "../attendance/attendanceModuleManifest.js";
import { attendanceRosterQuerySchema } from "../attendance/attendanceApiSchemas.js";
import { errorResponse } from "./attendance.contractSchemas.js";

/**
 * Marking-matrix route.
 *
 * Separate from the interactive list because a roster is a different resource: the grid needs every
 * mark for one class/day (it cannot page), so the bound is the roster cap rather than the list's 100.
 */
export const attendanceMatrixRoutes = {
  getRoster: {
    method: "GET",
    path: "/api/attendance/roster",
    query: attendanceRosterQuerySchema,
    responses: {
      200: z.object({ records: z.array(attendanceRecordSchema) }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Every live mark for one class/section on one day (marking matrix)",
  },
} as const;
