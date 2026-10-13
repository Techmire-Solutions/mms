import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { dashboardPreferencesPutBodySchema } from "../dashboard/dashboardPreferencesTypes.js";
import {
  dashboardWidgetsPutBodySchema,
  customWidgetSchema,
} from "../dashboard/dashboardWidgetSchema.js";

const c = initContract();

const errorResponse = z.unknown();

const dashboardSuccessResponseSchema = z.object({ success: z.literal(true) });

/** Normalized dashboard chart/layout preferences (`DashboardPreferences`). */
const dashboardPreferencesResponseSchema = z.object({
  disabledCardIds: z.array(z.string()),
  gridMode: z.enum(["comfortable", "compact"]),
  lowAttendanceThreshold: z.number(),
  urgentAttendanceThreshold: z.number(),
  enrollmentChartType: z.enum(["area", "bar", "line"]),
  enrollmentChartColor: z.string(),
  enrollmentChartPeriod: z.number(),
  revenueChartType: z.string(),
  revenueChartColor: z.string(),
  attendanceChartType: z.string(),
  attendanceChartColor: z.string(),
  hasanatChartType: z.string(),
  hasanatChartColor: z.string(),
});

export const dashboardContract = c.router({
  getPreferences: {
    method: "GET",
    path: "/api/dashboard/preferences",
    responses: {
      200: z.object({ preferences: dashboardPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get dashboard preferences",
  },
  putPreferences: {
    method: "PUT",
    path: "/api/dashboard/preferences",
    body: dashboardPreferencesPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), preferences: dashboardPreferencesResponseSchema }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update dashboard preferences",
  },
  getWidgets: {
    method: "GET",
    path: "/api/dashboard/widgets",
    responses: {
      200: z.object({ widgets: z.array(customWidgetSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get dashboard widgets",
  },
  putWidgets: {
    method: "PUT",
    path: "/api/dashboard/widgets",
    body: dashboardWidgetsPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), widgets: z.array(customWidgetSchema) }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update dashboard widgets",
  },
  deleteWidget: {
    method: "DELETE",
    path: "/api/dashboard/widgets/:id",
    pathParams: z.object({ id: z.string() }),
    body: z.any().optional(),
    responses: {
      200: dashboardSuccessResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Delete a dashboard widget",
  },
  reorderWidgets: {
    method: "PUT",
    path: "/api/dashboard/widgets/reorder",
    body: z.object({
      order: z.array(
        z.object({
          id: z.string().min(1),
          sortOrder: z.number(),
        }),
      ),
    }),
    responses: {
      200: dashboardSuccessResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Reorder dashboard widgets",
  },
  getSummary: {
    method: "GET",
    path: "/api/dashboard/summary",
    query: z
      .object({
        date: z.string().optional(),
        role: z.string().optional(),
      })
      .optional(),
    responses: {
      200: z.object({ summary: z.record(z.string(), z.unknown()) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get composite tenant dashboard summary metrics",
  },
});
