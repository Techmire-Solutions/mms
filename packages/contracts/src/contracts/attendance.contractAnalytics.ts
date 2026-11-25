import { z } from "zod";
import { widgetAggregateResultSchema, widgetAggregatesBodySchema } from "../schemas/common.dto.js";
import {
  attendanceReportAggregatesHttpQuerySchema,
  attendanceReportAggregatesSchema,
} from "../attendance/attendanceReportAggregates.js";
import {
  attendanceMarkedDatesQuerySchema,
  attendanceMarkedDatesSchema,
} from "../attendance/attendanceCoverage.js";
import { errorResponse } from "./attendance.contractSchemas.js";

/**
 * Read-only analytics routes (widgets, report aggregates, marked days).
 *
 * Split out of `attendance.contract.ts` for the 300-line band; merged back into the same router, so
 * route keys and the implementation mapping are unchanged.
 */
export const attendanceAnalyticsRoutes = {
  widgetAggregates: {
    method: "POST",
    path: "/api/attendance/widget-aggregates",
    body: widgetAggregatesBodySchema,
    responses: {
      200: z.record(z.string(), widgetAggregateResultSchema),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get widget aggregates",
  },
  reportAggregates: {
    method: "GET",
    path: "/api/attendance/report-aggregates",
    query: attendanceReportAggregatesHttpQuerySchema,
    responses: {
      200: attendanceReportAggregatesSchema,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get attendance report aggregates",
  },
  markedDates: {
    method: "GET",
    path: "/api/attendance/marked-dates",
    query: attendanceMarkedDatesQuerySchema,
    responses: {
      200: attendanceMarkedDatesSchema,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get the days that already have attendance marked",
  },
} as const;
