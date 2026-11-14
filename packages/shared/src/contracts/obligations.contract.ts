import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { bulkStringIdsBodySchema, softDeleteBodySchema } from "../core/apiSchemas.js";
import {
  obligationsReportAggregatesSchema,
  obligationsReportQuerySchema,
} from "../obligations/obligationsReportAggregates.js";
import {
  obligationTypeRecordSchema,
  mujtahidRecordSchema,
  mujtahidRepRecordSchema,
  wakalaTypeRecordSchema,
  obligationDistributionRecordSchema,
  obligationCollectionRecordSchema,
  obligationTypeListSchema,
  mujtahidListSchema,
  mujtahidRepListSchema,
  wakalaTypeListSchema,
  obligationDistributionListSchema,
  obligationCollectionListSchema,
  obligationsCollectionsQuerySchema,
  wakalaAggregateBodySchema,
} from "../obligations/obligationsModuleManifest.js";
import {
  obligationsPreferencesPutBodySchema,
  obligationsPreferencesResponseSchema,
} from "../obligations/obligationsSetupConfigTypes.js";

const c = initContract();
const ok = z.unknown();

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
const obligationsBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

export const obligationContract = c.router({
  listCollections: {
    method: "GET",
    path: "/api/obligations/collections",
    // Strict: only `includeDeleted`, `limit` and `offset` are honoured, and the default/ceiling is
    // OBLIGATIONS_COLLECTIONS_MAX_LIMIT rows. Anything else is rejected rather than ignored.
    query: obligationsCollectionsQuerySchema,
    responses: {
      200: z.array(obligationCollectionRecordSchema),
      400: ok,
      403: ok,
      500: ok,
    },
    summary: "List obligation collections (max 2000 rows; filter client-side)",
  },
  listTypes: {
    method: "GET",
    path: "/api/obligations/types",
    query: z.object({}).optional(),
    responses: { 200: z.array(obligationTypeRecordSchema), 400: ok, 403: ok, 500: ok },
    summary: "List obligation types",
  },
  listMujtahids: {
    method: "GET",
    path: "/api/obligations/mujtahids",
    query: z.object({}).optional(),
    responses: { 200: z.array(mujtahidRecordSchema), 400: ok, 403: ok, 500: ok },
    summary: "List mujtahids",
  },
  listDistributions: {
    method: "GET",
    path: "/api/obligations/distributions",
    query: z.object({}).optional(),
    responses: { 200: z.array(obligationDistributionRecordSchema), 400: ok, 403: ok, 500: ok },
    summary: "List obligation distributions",
  },
  listReps: {
    method: "GET",
    path: "/api/obligations/reps",
    query: z.object({}).optional(),
    responses: {
      200: z.object({ reps: z.array(mujtahidRepRecordSchema) }),
      400: ok,
      409: ok,
      403: ok,
      500: ok,
    },
    summary: "List mujtahid reps",
  },
  listWakala: {
    method: "GET",
    path: "/api/obligations/wakala",
    query: z.object({}).optional(),
    responses: {
      200: z.object({ wakalaTypes: z.array(wakalaTypeRecordSchema) }),
      400: ok,
      409: ok,
      403: ok,
      500: ok,
    },
    summary: "List wakala types",
  },
  replaceTypes: {
    method: "PUT",
    path: "/api/obligations/types/bulk",
    body: obligationTypeListSchema,
    responses: {
      200: z.object({ types: z.array(obligationTypeRecordSchema) }),
      400: ok,
      409: ok,
      403: ok,
      500: ok,
    },
    summary: "Replace obligation types",
  },
  replaceMujtahids: {
    method: "PUT",
    path: "/api/obligations/mujtahids/bulk",
    body: mujtahidListSchema,
    responses: {
      200: z.object({ mujtahids: z.array(mujtahidRecordSchema) }),
      400: ok,
      409: ok,
      403: ok,
      500: ok,
    },
    summary: "Replace mujtahids",
  },
  replaceReps: {
    method: "PUT",
    path: "/api/obligations/reps/bulk",
    body: mujtahidRepListSchema,
    responses: {
      200: z.object({ reps: z.array(mujtahidRepRecordSchema) }),
      400: ok,
      409: ok,
      403: ok,
      500: ok,
    },
    summary: "Replace mujtahid reps",
  },
  replaceWakala: {
    method: "PUT",
    path: "/api/obligations/wakala/bulk",
    body: wakalaTypeListSchema,
    responses: {
      200: z.object({ wakalaTypes: z.array(wakalaTypeRecordSchema) }),
      400: ok,
      409: ok,
      403: ok,
      500: ok,
    },
    summary: "Replace wakala types",
  },
  replaceDistributions: {
    method: "PUT",
    path: "/api/obligations/distributions/bulk",
    body: obligationDistributionListSchema,
    responses: {
      200: z.object({ distributions: z.array(obligationDistributionRecordSchema) }),
      400: ok,
      409: ok,
      403: ok,
      500: ok,
    },
    summary: "Replace distributions",
  },
  /**
   * Wakala + distribution rules as one aggregate.
   *
   * The two endpoints above replace each half separately, so a client that saves a wakala and then
   * its rules leaves a window where the wakala has no rules and a receipt saved in it posts 100 %
   * to income. This endpoint writes both halves in one transaction.
   */
  replaceWakalaAggregate: {
    method: "PUT",
    path: "/api/obligations/wakala-aggregate/bulk",
    body: wakalaAggregateBodySchema,
    responses: {
      200: z.object({
        wakalaTypes: z.array(wakalaTypeRecordSchema),
        distributions: z.array(obligationDistributionRecordSchema),
      }),
      400: ok,
      403: ok,
      409: ok,
      500: ok,
    },
    summary: "Replace a wakala and its distribution rules atomically",
  },
  replaceCollections: {
    method: "PUT",
    path: "/api/obligations/collections/bulk",
    body: obligationCollectionListSchema,
    // Named for the historical replace semantics, but the route **upserts** the given receipts
    // (keyed by workspace + id) and never removes a row. Sending the whole directory is therefore
    // pointless and unsafe: every row's `version` is bumped, and a future true-replace handler
    // would hard-purge anything absent from the payload.
    responses: {
      200: z.object({ collections: z.array(obligationCollectionRecordSchema) }),
      400: ok,
      403: ok,
      500: ok,
    },
    summary: "Replace collections",
  },
  deleteCollection: {
    method: "DELETE",
    path: "/api/obligations/collections/:id",
    pathParams: z.object({ id: z.string().trim().min(1).max(64) }),
    body: softDeleteBodySchema.optional(),
    responses: { 200: z.object({ success: z.literal(true) }), 403: ok, 404: ok, 500: ok },
    summary: "Delete obligation collection",
  },
  restoreCollection: {
    method: "POST",
    path: "/api/obligations/collections/:id/restore",
    pathParams: z.object({ id: z.string().trim().min(1).max(64) }),
    body: z.object({}).optional(),
    responses: { 200: z.object({ success: z.literal(true) }), 403: ok, 404: ok, 500: ok },
    summary: "Restore obligation collection",
  },
  bulkDeleteCollections: {
    method: "POST",
    path: "/api/obligations/collections/bulk-delete",
    body: bulkStringIdsBodySchema,
    responses: { 200: obligationsBulkResultResponseSchema, 403: ok, 500: ok },
    summary: "Bulk soft-delete obligation collections",
  },
  bulkRestoreCollections: {
    method: "POST",
    path: "/api/obligations/collections/bulk-restore",
    body: bulkStringIdsBodySchema,
    responses: { 200: obligationsBulkResultResponseSchema, 403: ok, 500: ok },
    summary: "Bulk restore obligation collections",
  },
  reportAggregates: {
    method: "GET",
    path: "/api/obligations/report-aggregates",
    query: obligationsReportQuerySchema.optional(),
    responses: { 200: obligationsReportAggregatesSchema, 403: ok, 500: ok },
    summary: "Get obligation report aggregates",
  },
  getPreferences: {
    method: "GET",
    path: "/api/obligations/preferences",
    responses: {
      200: z.object({ preferences: obligationsPreferencesResponseSchema }),
      400: ok,
      403: ok,
      500: ok,
    },
    summary: "Get obligations module preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/obligations/preferences",
    body: obligationsPreferencesPutBodySchema,
    responses: {
      200: z.object({
        success: z.literal(true),
        preferences: obligationsPreferencesResponseSchema,
      }),
      // The router maps a domain rejection through `obligationsError`; declare it so the client
      // types match what the handler can actually return.
      400: ok,
      403: ok,
      500: ok,
    },
    summary: "Update obligations module preferences",
  },
  getCollectionVoucher: {
    method: "GET",
    path: "/api/obligations/collections/:id/voucher",
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: z.object({
        entry: z.record(z.string(), z.unknown()),
        accounts: z.array(z.record(z.string(), z.unknown())),
      }),
      403: ok,
      404: ok,
      500: ok,
    },
    summary: "Get accounting voucher for an obligation collection",
  },
});
