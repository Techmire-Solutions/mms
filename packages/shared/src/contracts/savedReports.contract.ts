import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  genericSavedReportCreateSchema,
  genericSavedReportListQuerySchema,
  genericSavedReportIdParamsSchema,
} from "../reports/savedReportsSchemas.js";

const c = initContract();

const savedReportResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  filters: z.record(z.string(), z.unknown()),
  lastRun: z.string().nullable().optional(),
  createdBy: z.string(),
  createdByName: z.string(),
  createdAt: z.string(),
});

const errorSchema = z.object({ type: z.string(), message: z.string() });

export const savedReportsContract = c.router({
  list: {
    method: "GET",
    path: "/api/saved-reports",
    query: genericSavedReportListQuerySchema,
    responses: {
      200: z.object({ reports: z.array(savedReportResponseSchema) }),
      400: errorSchema,
      403: errorSchema,
      500: errorSchema,
    },
    summary: "List saved reports for a category",
  },
  create: {
    method: "POST",
    path: "/api/saved-reports",
    body: genericSavedReportCreateSchema,
    responses: {
      201: z.object({ report: savedReportResponseSchema }),
      400: errorSchema,
      403: errorSchema,
      500: errorSchema,
    },
    summary: "Create a saved report preset",
  },
  delete: {
    method: "DELETE",
    path: "/api/saved-reports/:id",
    pathParams: genericSavedReportIdParamsSchema,
    query: genericSavedReportListQuerySchema,
    body: z.void().optional(),
    responses: {
      200: z.object({ success: z.boolean() }),
      400: errorSchema,
      403: errorSchema,
      404: errorSchema,
      500: errorSchema,
    },
    summary: "Delete a saved report preset",
  },
  run: {
    method: "POST",
    path: "/api/saved-reports/:id/run",
    pathParams: genericSavedReportIdParamsSchema,
    query: genericSavedReportListQuerySchema,
    body: z.void().optional(),
    responses: {
      200: z.object({ report: savedReportResponseSchema }),
      400: errorSchema,
      403: errorSchema,
      404: errorSchema,
      500: errorSchema,
    },
    summary: "Run a saved report and return results",
  },
});
