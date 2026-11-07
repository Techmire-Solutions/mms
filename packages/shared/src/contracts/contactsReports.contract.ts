import { z } from "zod";
import { contactRecordSchema } from "../contacts/contactsModuleManifest.js";
import { baseListQuerySchema } from "../core/apiSchemas.js";
import { contactSavedReportSchema } from "./contacts.contract.schemas.js";
import { contactsSavedReportCreateSchema } from "../schemas/contacts.dto.js";
import { contactsDuplicateScanBodySchema } from "../schemas/contactsOperations.dto.js";

const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();

export const contactsReportAnalyticsQuerySchema = z.object({
  years: z
    .union([z.string(), z.array(z.number())])
    .optional()
    .transform((value) => {
      if (Array.isArray(value)) return value;
      return value
        ? value
            .split(",")
            .map((year) => Number.parseInt(year.trim(), 10))
            .filter((year) => Number.isFinite(year) && year >= 1900 && year <= 2100)
        : [];
    }),
  lang: z.string().max(16).optional(),
});

/** Contact report analytics snapshot (`ContactsReportAnalyticsSnapshot`). */
const contactReportAnalyticsResponseSchema = z.object({
  analytics: z.object({
    total: z.number(),
    activeCount: z.number(),
    whatsappCount: z.number(),
    whatsappRate: z.number(),
    missingInfoCount: z.number(),
    newLast30Days: z.number(),
    newPrior30Days: z.number(),
    newThisPeriod: z.number(),
    hasSignupDates: z.boolean(),
    growthRecentSignups30d: z.number(),
    growthPriorSignups30d: z.number(),
  }),
  monthlyByYear: z
    .array(
      z.object({
        year: z.number(),
        months: z.array(z.object({ month: z.string(), count: z.number() })),
      }),
    )
    .optional(),
});

/** Duplicate-pair page envelope (`ContactsDuplicatePairsPageResult` with sanitized contacts). */
const contactDuplicatePairsPageResponseSchema = z.object({
  pairs: z.array(
    z.object({
      id: z.string(),
      confidence: z.number(),
      reasonKey: z.string(),
      contacts: z.array(contactRecordSchema),
    }),
  ),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

/** Reports, analytics, duplicates, and saved-report routes. */
export const contactsReportsRoutes = {
  reportAnalytics: {
    method: "GET",
    path: "/api/contacts/report-analytics",
    query: contactsReportAnalyticsQuerySchema,
    responses: {
      200: contactReportAnalyticsResponseSchema,
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get contact report analytics",
  },
  getDuplicates: {
    method: "GET",
    path: "/api/contacts/duplicates",
    query: baseListQuerySchema,
    responses: {
      200: contactDuplicatePairsPageResponseSchema,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get contact duplicates",
  },
  scanDuplicates: {
    method: "POST",
    path: "/api/contacts/duplicates/scan",
    body: contactsDuplicateScanBodySchema,
    responses: {
      202: z.object({
        job: z
          .object({
            id: z.string(),
            status: z.string().optional(),
          })
          .passthrough(),
      }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Queue background duplicate scan",
  },
  getSavedReports: {
    method: "GET",
    path: "/api/contacts/saved-reports",
    responses: {
      200: z.object({ reports: z.array(contactSavedReportSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get contact saved reports",
  },
  createSavedReport: {
    method: "POST",
    path: "/api/contacts/saved-reports",
    body: contactsSavedReportCreateSchema,
    responses: {
      200: z.object({ report: contactSavedReportSchema }),
      400: errorResponse,
      500: errorResponse,
    },
    summary: "Create contact saved report",
  },
  deleteSavedReport: {
    method: "DELETE",
    path: "/api/contacts/saved-reports/:id",
    pathParams: z.object({ id: z.string() }),
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Delete contact saved report",
  },
  runSavedReport: {
    method: "POST",
    path: "/api/contacts/saved-reports/:id/run",
    pathParams: z.object({ id: z.string() }),
    body: z.unknown(),
    responses: {
      200: z.object({ report: contactSavedReportSchema }),
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Run contact saved report",
  },
} as const;
