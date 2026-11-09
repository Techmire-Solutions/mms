import { z } from "zod";
import {
  attendanceLeaveInsertSchema,
  attendanceLeaveReviewSchema,
  attendanceLeaveCancelSchema,
  attendanceLeaveListQuerySchema,
  attendanceLeaveSchema,
} from "../attendance/attendanceModuleManifest.js";
import {
  attendanceDaySubmissionResponseSchema,
  errorResponse,
} from "./attendance.contractSchemas.js";
import {
  attendanceDayPathParamsSchema,
  attendanceIdPathParamsSchema,
} from "../attendance/attendanceApiSchemas.js";

/**
 * Attendance lifecycle routes: roster-day submission and the excuse/leave workflow.
 *
 * Extracted from `attendance.contract.ts` (300-line band); merged back into the same router, so the
 * route keys and implementation mapping are unchanged.
 */

export const attendanceLeaveListResponseSchema = z.object({
  leaves: z.array(attendanceLeaveSchema),
});

export const attendanceLifecycleRoutes = {
  getDaySubmission: {
    method: "GET",
    path: "/api/attendance/days/:classId/:date",
    pathParams: attendanceDayPathParamsSchema,
    responses: {
      200: attendanceDaySubmissionResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Read a class roster day's submission state",
  },
  submitDay: {
    method: "POST",
    path: "/api/attendance/days/:classId/:date/submit",
    pathParams: attendanceDayPathParamsSchema,
    body: z.object({}).optional(),
    responses: {
      200: attendanceDaySubmissionResponseSchema,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Submit (lock) a class roster for one day",
  },
  reopenDay: {
    method: "POST",
    path: "/api/attendance/days/:classId/:date/reopen",
    pathParams: attendanceDayPathParamsSchema,
    body: z.object({ reason: z.string().max(500).optional() }).optional(),
    responses: {
      200: attendanceDaySubmissionResponseSchema,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Reopen a submitted class roster day",
  },
  listLeaves: {
    method: "GET",
    path: "/api/attendance/leaves",
    query: attendanceLeaveListQuerySchema,
    responses: {
      200: attendanceLeaveListResponseSchema,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List excuse / leave requests",
  },
  submitLeave: {
    method: "POST",
    path: "/api/attendance/leaves",
    body: attendanceLeaveInsertSchema,
    responses: {
      201: attendanceLeaveSchema,
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Submit an excuse / leave request (pending review)",
  },
  reviewLeave: {
    method: "POST",
    path: "/api/attendance/leaves/:id/review",
    pathParams: attendanceIdPathParamsSchema,
    body: attendanceLeaveReviewSchema,
    responses: {
      200: attendanceLeaveSchema,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Approve or reject an excuse (retroactively excuses the covered absences)",
  },
  cancelLeave: {
    method: "POST",
    path: "/api/attendance/leaves/:id/cancel",
    pathParams: attendanceIdPathParamsSchema,
    body: attendanceLeaveCancelSchema,
    responses: {
      200: attendanceLeaveSchema,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Cancel a pending or approved excuse",
  },
} as const;
