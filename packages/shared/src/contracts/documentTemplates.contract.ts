import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { documentTemplateSchema } from "../documents/documentTemplateCoreTypes.js";

const c = initContract();

const errorSchema = z.object({
  type: z.string(),
  message: z.string(),
});

export const documentTemplateKeyParamsSchema = z.object({
  key: z.string().min(1).max(128),
});

export const documentTemplateSaveBodySchema = z.object({
  template: documentTemplateSchema,
  /**
   * The `updatedAt` the client last read, or `null` when it read no layout. The server
   * rejects a save whose expectation no longer matches with 409 so two admins cannot
   * silently overwrite each other.
   */
  expectedUpdatedAt: z.string().datetime().nullable(),
});

export const documentTemplatesContract = c.router({
  get: {
    method: "GET",
    path: "/api/templates/:key",
    pathParams: documentTemplateKeyParamsSchema,
    responses: {
      200: z.object({
        template: documentTemplateSchema.nullable(),
        updatedAt: z.string().datetime().nullable(),
      }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      500: errorSchema,
    },
    summary: "Retrieve a document template by storage key",
  },
  save: {
    method: "PUT",
    path: "/api/templates/:key",
    pathParams: documentTemplateKeyParamsSchema,
    body: documentTemplateSaveBodySchema,
    responses: {
      200: z.object({
        template: documentTemplateSchema,
        updatedAt: z.string().datetime(),
      }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      409: errorSchema,
      500: errorSchema,
    },
    summary: "Save or update a document template layout by storage key",
  },
  delete: {
    method: "DELETE",
    path: "/api/templates/:key",
    pathParams: documentTemplateKeyParamsSchema,
    body: z.void().optional(),
    responses: {
      200: z.object({
        success: z.boolean(),
      }),
      400: errorSchema,
      401: errorSchema,
      403: errorSchema,
      404: errorSchema,
      500: errorSchema,
    },
    summary: "Delete / reset a document template by storage key",
  },
});
