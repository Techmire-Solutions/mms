import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  baseListQuerySchema,
  bulkStringIdsBodySchema,
  softDeleteBodySchema,
} from "../core/apiSchemas.js";
import { widgetAggregatesBodySchema } from "../schemas/common.dto.js";
import {
  hasanatFieldConfigPutBodySchema,
  hasanatPreferencesPutBodySchema,
} from "../hasanat/hasanatSetupConfigTypes.js";
import {
  denomRecordSchema,
  batchRecordSchema,
  distributionRecordSchema,
  redemptionRecordSchema,
  denomListSchema,
  batchListSchema,
  distributionListSchema,
  redemptionListSchema,
} from "../hasanat/hasanatModuleManifest.js";
import { hasanatReportAggregatesSchema } from "../hasanat/hasanatReportAggregates.js";
import { reportComparisonQuerySchema } from "../reports/reportComparisonQuery.js";

const c = initContract();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const ok = z.unknown();

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
const hasanatBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

/** Envelope for paginated hasanat distribution list responses. */
export const hasanatDistributionsPageResponseSchema = z.object({
  distributions: z.array(distributionRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

/** Normalized Hasanat Setup preferences (`HasanatModulePreferences`). */
export const hasanatPreferencesResponseSchema = z.object({
  pointsPerUnit: z.number(),
  autoApprovePayouts: z.boolean(),
  defaultViewLayout: z.string(),
});

const hasanatWidgetAggregateResultSchema = z.object({
  value: z.number(),
  totalCount: z.number(),
  chartData: z.array(z.object({ name: z.string(), value: z.number() })),
});

export const hasanatContract = c.router({
  listDistributions: {
    method: "GET",
    path: "/api/hasanat/distributions",
    query: baseListQuerySchema,
    responses: { 200: hasanatDistributionsPageResponseSchema, 403: ok, 500: ok },
    summary: "List hasanat distributions",
  },
  createDistribution: {
    method: "POST",
    path: "/api/hasanat/distributions",
    body: distributionRecordSchema,
    responses: {
      201: z.object({ distribution: distributionRecordSchema }),
      403: ok,
      500: ok,
    },
    summary: "Create a hasanat distribution",
  },
  updateDistribution: {
    method: "PUT",
    path: "/api/hasanat/distributions/:id",
    body: distributionRecordSchema,
    responses: {
      200: z.object({ distribution: distributionRecordSchema }),
      403: ok,
      404: ok,
      500: ok,
    },
    summary: "Update a hasanat distribution",
  },
  bulkDeleteDistributions: {
    method: "POST",
    path: "/api/hasanat/distributions/bulk-delete",
    body: bulkStringIdsBodySchema,
    responses: { 200: hasanatBulkResultResponseSchema, 403: ok, 500: ok },
    summary: "Bulk soft-delete distributions",
  },
  bulkRestoreDistributions: {
    method: "POST",
    path: "/api/hasanat/distributions/bulk-restore",
    body: bulkStringIdsBodySchema,
    responses: { 200: hasanatBulkResultResponseSchema, 403: ok, 500: ok },
    summary: "Bulk restore distributions",
  },
  listDenoms: {
    method: "GET",
    path: "/api/hasanat/denoms",
    query: z.object({}).optional(),
    responses: { 200: z.array(denomRecordSchema), 403: ok, 500: ok },
    summary: "List hasanat denominations",
  },
  listBatches: {
    method: "GET",
    path: "/api/hasanat/batches",
    query: z.object({}).optional(),
    responses: { 200: z.array(batchRecordSchema), 403: ok, 500: ok },
    summary: "List hasanat batches",
  },
  listRedemptions: {
    method: "GET",
    path: "/api/hasanat/redemptions",
    query: z.object({}).optional(),
    responses: { 200: z.array(redemptionRecordSchema), 403: ok, 500: ok },
    summary: "List hasanat redemptions",
  },
  reportAggregates: {
    method: "GET",
    path: "/api/hasanat/report-aggregates",
    query: reportComparisonQuerySchema.optional(),
    responses: { 200: hasanatReportAggregatesSchema, 403: ok, 500: ok },
    summary: "Report aggregates",
  },
  replaceDenoms: {
    method: "PUT",
    path: "/api/hasanat/denoms/bulk",
    body: denomListSchema,
    responses: { 200: z.object({ denoms: z.array(denomRecordSchema) }), 403: ok, 500: ok },
    summary: "Replace denoms",
  },
  replaceBatches: {
    method: "PUT",
    path: "/api/hasanat/batches/bulk",
    body: batchListSchema,
    responses: { 200: z.object({ batches: z.array(batchRecordSchema) }), 403: ok, 500: ok },
    summary: "Replace batches",
  },
  replaceDistributions: {
    method: "PUT",
    path: "/api/hasanat/distributions/bulk",
    body: distributionListSchema,
    responses: {
      200: z.object({ distributions: z.array(distributionRecordSchema) }),
      403: ok,
      500: ok,
    },
    summary: "Replace distributions",
  },
  replaceRedemptions: {
    method: "PUT",
    path: "/api/hasanat/redemptions/bulk",
    body: redemptionListSchema,
    responses: {
      200: z.object({ redemptions: z.array(redemptionRecordSchema) }),
      403: ok,
      500: ok,
    },
    summary: "Replace redemptions",
  },
  deleteDistribution: {
    method: "DELETE",
    path: "/api/hasanat/distributions/:id",
    body: softDeleteBodySchema.optional(),
    responses: { 200: z.object({ success: z.literal(true) }), 403: ok, 404: ok, 500: ok },
    summary: "Delete distribution",
  },
  restoreDistribution: {
    method: "POST",
    path: "/api/hasanat/distributions/:id/restore",
    body: z.object({}).optional(),
    responses: { 200: z.object({ success: z.literal(true) }), 403: ok, 404: ok, 500: ok },
    summary: "Restore distribution",
  },
  widgetAggregates: {
    method: "POST",
    path: "/api/hasanat/widget-aggregates",
    body: widgetAggregatesBodySchema,
    responses: {
      200: z.record(z.string(), hasanatWidgetAggregateResultSchema),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get widget aggregates",
  },

  getFieldConfig: {
    method: "GET",
    path: "/api/hasanat/field-config",
    responses: {
      200: z.object({ config: z.record(z.string(), z.unknown()).nullable() }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get field config",
  },
  updateFieldConfig: {
    method: "PUT",
    path: "/api/hasanat/field-config",
    body: hasanatFieldConfigPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), config: z.record(z.string(), z.unknown()) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update field config",
  },
  getPreferences: {
    method: "GET",
    path: "/api/hasanat/preferences",
    responses: {
      200: z.object({ preferences: hasanatPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/hasanat/preferences",
    body: hasanatPreferencesPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), preferences: hasanatPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update preferences",
  },
  getLookups: {
    method: "GET",
    path: "/api/hasanat/lookups",
    responses: { 200: z.unknown(), 403: errorResponse, 500: errorResponse },
    summary: "Get all lookups",
  },
  getLookupKind: {
    method: "GET",
    path: "/api/hasanat/lookups/:kind",
    responses: { 200: z.unknown(), 403: errorResponse, 500: errorResponse },
    summary: "Get a specific lookup kind",
  },
});
