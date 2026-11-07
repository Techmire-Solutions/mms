import { z } from "zod";
import { sessionsBulkStatusSchema } from "../sessions/sessionsModuleManifest.js";
import { sessionErrorResponseSchema } from "./sessionContractShared.js";

const errorResponse = sessionErrorResponseSchema;

const asyncBulkIdempotencyKey = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .optional();

export const sessionsBulkStatusJobBodySchema = sessionsBulkStatusSchema
  .extend({ idempotencyKey: asyncBulkIdempotencyKey })
  .strict();
export const sessionsBulkArchiveJobBodySchema = z
  .object({
    ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .max(500),
    deletionReason: z.string().max(500).optional(),
    idempotencyKey: asyncBulkIdempotencyKey,
  })
  .strict();

const backgroundJobEnvelopeSchema = z.object({
  job: z
    .object({
      id: z.string(),
      moduleId: z.string(),
      kind: z.string(),
      status: z.string(),
      label: z.string(),
    })
    .passthrough(),
});

export const sessionBulkJobContractEndpoints = {
  bulkStatusJob: {
    method: "POST" as const,
    path: "/api/sessions/bulk-status/jobs",
    body: sessionsBulkStatusJobBodySchema,
    responses: {
      202: backgroundJobEnvelopeSchema,
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Queue an asynchronous bulk lifecycle change",
  },
  bulkArchiveJob: {
    method: "POST" as const,
    path: "/api/sessions/bulk-archive/jobs",
    body: sessionsBulkArchiveJobBodySchema,
    responses: {
      202: backgroundJobEnvelopeSchema,
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Queue an asynchronous bulk archive (soft delete)",
  },
};
