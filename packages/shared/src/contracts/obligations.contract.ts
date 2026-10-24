import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  baseListQuerySchema,
  bulkStringIdsBodySchema,
  softDeleteBodySchema,
} from "../core/apiSchemas.js";
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
    query: baseListQuerySchema,
    responses: { 200: z.array(obligationCollectionRecordSchema), 403: ok, 500: ok },
    summary: "List obligation collections",
  },
  listTypes: {
    method: "GET",
    path: "/api/obligations/types",
    query: z.object({}).optional(),
    responses: { 200: z.array(obligationTypeRecordSchema), 403: ok, 500: ok },
    summary: "List obligation types",
  },
  listMujtahids: {
    method: "GET",
    path: "/api/obligations/mujtahids",
    query: z.object({}).optional(),
    responses: { 200: z.array(mujtahidRecordSchema), 403: ok, 500: ok },
    summary: "List mujtahids",
  },
  listDistributions: {
    method: "GET",
    path: "/api/obligations/distributions",
    query: z.object({}).optional(),
    responses: { 200: z.array(obligationDistributionRecordSchema), 403: ok, 500: ok },
    summary: "List obligation distributions",
  },
  listReps: {
    method: "GET",
    path: "/api/obligations/reps",
    query: z.object({}).optional(),
    responses: { 200: z.object({ reps: z.array(mujtahidRepRecordSchema) }), 403: ok, 500: ok },
    summary: "List mujtahid reps",
  },
  listWakala: {
    method: "GET",
    path: "/api/obligations/wakala",
    query: z.object({}).optional(),
    responses: {
      200: z.object({ wakalaTypes: z.array(wakalaTypeRecordSchema) }),
      403: ok,
      500: ok,
    },
    summary: "List wakala types",
  },
  replaceTypes: {
    method: "PUT",
    path: "/api/obligations/types/bulk",
    body: obligationTypeListSchema,
    responses: { 200: z.object({ types: z.array(obligationTypeRecordSchema) }), 403: ok, 500: ok },
    summary: "Replace obligation types",
  },
  replaceMujtahids: {
    method: "PUT",
    path: "/api/obligations/mujtahids/bulk",
    body: mujtahidListSchema,
    responses: { 200: z.object({ mujtahids: z.array(mujtahidRecordSchema) }), 403: ok, 500: ok },
    summary: "Replace mujtahids",
  },
  replaceReps: {
    method: "PUT",
    path: "/api/obligations/reps/bulk",
    body: mujtahidRepListSchema,
    responses: { 200: z.object({ reps: z.array(mujtahidRepRecordSchema) }), 403: ok, 500: ok },
    summary: "Replace mujtahid reps",
  },
  replaceWakala: {
    method: "PUT",
    path: "/api/obligations/wakala/bulk",
    body: wakalaTypeListSchema,
    responses: {
      200: z.object({ wakalaTypes: z.array(wakalaTypeRecordSchema) }),
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
      403: ok,
      500: ok,
    },
    summary: "Replace distributions",
  },
  replaceCollections: {
    method: "PUT",
    path: "/api/obligations/collections/bulk",
    body: obligationCollectionListSchema,
    responses: {
      200: z.object({ collections: z.array(obligationCollectionRecordSchema) }),
      403: ok,
      500: ok,
    },
    summary: "Replace collections",
  },
  deleteCollection: {
    method: "DELETE",
    path: "/api/obligations/collections/:id",
    body: softDeleteBodySchema.optional(),
    responses: { 200: z.object({ success: z.literal(true) }), 403: ok, 404: ok, 500: ok },
    summary: "Delete obligation collection",
  },
  restoreCollection: {
    method: "POST",
    path: "/api/obligations/collections/:id/restore",
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
  widgetAggregates: {
    method: "POST",
    path: "/api/obligations/widget-aggregates",
    body: z.object({ widgets: z.array(z.unknown()) }),
    responses: { 200: z.unknown(), 403: ok, 500: ok },
    summary: "Get widget aggregates",
  },
  getPreferences: {
    method: "GET",
    path: "/api/obligations/preferences",
    responses: {
      200: z.object({ preferences: obligationsPreferencesResponseSchema }),
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
      403: ok,
      500: ok,
    },
    summary: "Update obligations module preferences",
  },
});
