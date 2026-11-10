import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  baseListQuerySchema,
  bulkStringIdsBodySchema,
  softDeleteBodySchema,
} from "../core/apiSchemas.js";
import { widgetAggregatesBodySchema } from "../schemas/common.dto.js";
import {
  denomRecordSchema,
  batchRecordSchema,
  distributionRecordSchema,
  redemptionRecordSchema,
  redeemCardBodySchema,
  reverseRedemptionBodySchema,
  distributionCreateSchema,
  distributionUpdateSchema,
  distributionStatusSchema,
  denomListSchema,
  batchListSchema,
  hasanatBatchesResponseSchema,
  hasanatDenomsResponseSchema,
  hasanatLedgerListQuerySchema,
  hasanatListLimitQuerySchema,
  hasanatRedemptionsPageResponseSchema,
} from "../hasanat/hasanatModuleManifest.js";
import { hasanatReportAggregatesSchema } from "../hasanat/hasanatReportAggregates.js";
import { hasanatTierBatchContractRoutes } from "./hasanatTierBatch.contract.js";
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
  dailyAwardLimitPerInstructor: z.number(),
});

const hasanatWidgetAggregateResultSchema = z.object({
  value: z.number(),
  totalCount: z.number(),
  chartData: z.array(z.object({ name: z.string(), value: z.number() })),
});

export const hasanatContract = c.router({
  ...hasanatTierBatchContractRoutes,
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
    body: distributionCreateSchema,
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
    body: distributionUpdateSchema,
    pathParams: z.object({ id: z.string().trim().min(1).max(64) }),
    responses: {
      200: z.object({ distribution: distributionRecordSchema }),
      403: ok,
      404: ok,
      500: ok,
    },
    summary: "Update a hasanat distribution",
  },
  redeemDistribution: {
    method: "POST",
    path: "/api/hasanat/distributions/:id/redeem",
    body: redeemCardBodySchema,
    pathParams: z.object({ id: z.string().trim().min(1).max(64) }),
    responses: {
      200: z.object({ redemption: redemptionRecordSchema }),
      403: ok,
      404: ok,
      409: ok,
      500: ok,
    },
    summary: "Redeem a hasanat card (atomic: ledger row + card status)",
  },
  changeDistributionStatus: {
    method: "POST",
    path: "/api/hasanat/distributions/:id/status",
    body: distributionStatusSchema,
    pathParams: z.object({ id: z.string().trim().min(1).max(64) }),
    responses: {
      200: z.object({ distribution: distributionRecordSchema }),
      403: ok,
      404: ok,
      409: ok,
      500: ok,
    },
    summary: "Move a card through the legal status state machine",
  },
  reverseRedemption: {
    method: "POST",
    path: "/api/hasanat/redemptions/:id/reverse",
    body: reverseRedemptionBodySchema,
    pathParams: z.object({ id: z.string().trim().min(1).max(64) }),
    responses: {
      200: z.object({ redemption: redemptionRecordSchema }),
      403: ok,
      404: ok,
      409: ok,
      500: ok,
    },
    summary: "Reverse a redemption by appending a ledger reversal row",
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
    query: hasanatListLimitQuerySchema.optional(),
    responses: { 200: hasanatDenomsResponseSchema, 400: ok, 403: ok, 500: ok },
    summary: "List hasanat denominations (bounded)",
  },
  listBatches: {
    method: "GET",
    path: "/api/hasanat/batches",
    query: hasanatListLimitQuerySchema.optional(),
    responses: { 200: hasanatBatchesResponseSchema, 400: ok, 403: ok, 500: ok },
    summary: "List hasanat batches (bounded)",
  },
  listRedemptions: {
    method: "GET",
    path: "/api/hasanat/redemptions",
    query: hasanatLedgerListQuerySchema.optional(),
    responses: {
      200: hasanatRedemptionsPageResponseSchema,
      400: ok,
      403: ok,
      500: ok,
    },
    summary: "Ledger history (paginated, newest first)",
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
  deleteDistribution: {
    method: "DELETE",
    path: "/api/hasanat/distributions/:id",
    body: softDeleteBodySchema.optional(),
    pathParams: z.object({ id: z.string().trim().min(1).max(64) }),
    responses: { 200: z.object({ success: z.literal(true) }), 403: ok, 404: ok, 500: ok },
    summary: "Delete distribution",
  },
  restoreDistribution: {
    method: "POST",
    path: "/api/hasanat/distributions/:id/restore",
    body: z.object({}).optional(),
    pathParams: z.object({ id: z.string().trim().min(1).max(64) }),
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
});
