import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  academicCalendarEventSchema,
  academicCalendarEventWriteSchema,
  academicCalendarListQuerySchema,
} from "../attendance/academicCalendarTypes.js";

const c = initContract();
const errorResponse = z.unknown();
const itemParams = z.object({ id: z.string().min(1).max(64) });

/** Attendance-owned academic calendar: holidays, make-up days, exam periods, events. */
export const academicCalendarContract = c.router({
  list: {
    method: "GET",
    path: "/api/attendance/calendar",
    query: academicCalendarListQuerySchema.optional(),
    responses: {
      200: z.object({ items: z.array(academicCalendarEventSchema) }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List academic calendar events overlapping a date range",
  },
  save: {
    method: "PUT",
    path: "/api/attendance/calendar/:id",
    pathParams: itemParams,
    body: academicCalendarEventWriteSchema,
    responses: {
      200: z.object({ item: academicCalendarEventSchema }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Create or update an academic calendar event",
  },
  remove: {
    method: "DELETE",
    path: "/api/attendance/calendar/:id",
    pathParams: itemParams,
    body: z.object({}).optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Soft-delete an academic calendar event",
  },
  restore: {
    method: "POST",
    path: "/api/attendance/calendar/:id/restore",
    pathParams: itemParams,
    body: z.object({}).optional(),
    responses: {
      200: z.object({ item: academicCalendarEventSchema }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a soft-deleted academic calendar event",
  },
});
