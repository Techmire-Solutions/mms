import { z } from "zod";
import { contactsBulkTagBodySchema } from "../contacts/contactEntityTypes.js";
import {
  contactIdentityMatchBodySchema,
  contactIdentityMatchResultSchema,
} from "../contacts/contactIdentityMatch.js";
import { contactValidationErrorSchema } from "../contacts/contactValidationErrors.js";
import { includeDeletedQuerySchema, softDeleteBodySchema } from "../core/apiSchemas.js";
import { contactsListQuerySchema } from "../contacts/contactsListQuery.js";
import { contactWireWriteSchema } from "../schemas/contacts.dto.js";
import { widgetAggregateResultSchema } from "../schemas/common.dto.js";
import {
  contactListPageResponseSchema,
  contactBulkResultResponseSchema,
  contactWrappedResponseSchema,
  contactResponseRecordSchema,
} from "./contacts.contract.schemas.js";

const responseWrapper = contactWrappedResponseSchema;
const bulkResult = contactBulkResultResponseSchema;
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();

const contactBulkRestoreResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
  conflicts: z.array(
    z.object({
      id: z.string(),
      // Server payloads carry `ValidationError` issues (`fieldId`/`tabId`/`message`);
      // matching that shape here keeps the typed client honest.
      errors: z.array(contactValidationErrorSchema),
    }),
  ),
});

/** Core CRUD, bulk, resolve, merge, and widget routes for contacts. */
export const contactsCrudRoutes = {
  list: {
    method: "GET",
    path: "/api/contacts",
    query: contactsListQuerySchema,
    responses: {
      200: contactListPageResponseSchema,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List contacts",
  },
  create: {
    method: "POST",
    path: "/api/contacts",
    /**
     * Create is create-shaped: posting an `id` that already exists is a 409
     * conflict unless the caller supplies the `updatedAt` it edited from, which
     * makes the request a versioned upsert (`mms-api-interface` §6).
     */
    headers: z.object({ "x-expected-updated-at": z.string().optional() }),
    body: contactWireWriteSchema,
    responses: {
      200: responseWrapper,
      201: responseWrapper,
      400: errorResponse,
      403: errorResponse,
      409: z.object({ type: z.literal("conflict"), message: z.string() }),
      500: errorResponse,
    },
    summary: "Create a new contact",
  },
  get: {
    method: "GET",
    path: "/api/contacts/:id",
    pathParams: z.object({ id: z.string() }),
    query: includeDeletedQuerySchema.optional(),
    responses: {
      200: z.object({ contact: contactResponseRecordSchema }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Get a contact by ID",
  },
  update: {
    method: "PUT",
    path: "/api/contacts/:id",
    pathParams: z.object({ id: z.string() }),
    /**
     * The `updatedAt` the client based its edit on. When present and stale, the
     * server rejects with 409 so two editors cannot silently overwrite each
     * other (`mms-api-interface` §6 Optimistic Concurrency).
     */
    headers: z.object({ "x-expected-updated-at": z.string().optional() }),
    body: contactWireWriteSchema,
    responses: {
      200: responseWrapper,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: z.object({ type: z.literal("conflict"), message: z.string() }),
      500: errorResponse,
    },
    summary: "Update a contact",
  },
  delete: {
    method: "DELETE",
    path: "/api/contacts/:id",
    pathParams: z.object({ id: z.string() }),
    /** Optional: DELETE may be sent with no body at all. */
    body: softDeleteBodySchema.optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Delete a contact",
  },
  restore: {
    method: "POST",
    path: "/api/contacts/:id/restore",
    body: z.unknown(),
    responses: {
      200: responseWrapper,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a contact",
  },
  bulkDelete: {
    method: "POST",
    path: "/api/contacts/bulk-delete",
    body: z.object({ ids: z.array(z.string()), deletionReason: z.string().optional() }),
    responses: { 200: bulkResult, 400: errorResponse, 409: errorResponse, 500: errorResponse },
    summary: "Bulk delete contacts",
  },
  bulkRestore: {
    method: "POST",
    path: "/api/contacts/bulk-restore",
    body: z.object({ ids: z.array(z.string()) }),
    responses: {
      200: contactBulkRestoreResponseSchema,
      400: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk restore contacts",
  },
  resolve: {
    method: "POST",
    path: "/api/contacts/resolve",
    body: z.object({ ids: z.array(z.string()) }),
    responses: {
      200: z.object({ contacts: z.array(contactResponseRecordSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Resolve contacts by IDs",
  },
  merge: {
    method: "POST",
    path: "/api/contacts/merge",
    /**
     * `merged` uses the wire DTO (passthrough) so tenant custom field keys are
     * not rejected at the boundary — the route re-parses with the tenant-aware
     * `buildContactMergeBodySchema(extraKeys)`.
     */
    body: z
      .object({
        keepId: z.union([z.string(), z.number()]),
        deleteId: z.union([z.string(), z.number()]),
        merged: contactWireWriteSchema.optional(),
      })
      .strict(),
    /**
     * `updatedAt` of the surviving contact the merge preview was computed from.
     * A stale value rejects the merge with 409 instead of silently reverting an
     * edit committed since the duplicate list was read (`mms-api-interface` §6).
     */
    headers: z.object({ "x-expected-updated-at": z.string().optional() }),
    responses: {
      200: responseWrapper,
      400: errorResponse,
      403: errorResponse,
      409: z.object({ type: z.literal("conflict"), message: z.string() }),
      500: errorResponse,
    },
    summary: "Merge contacts",
  },
  identityMatch: {
    method: "POST",
    path: "/api/contacts/identity-match",
    body: contactIdentityMatchBodySchema,
    responses: { 200: contactIdentityMatchResultSchema, 400: errorResponse, 500: errorResponse },
    summary: "Match contact identity",
  },
  bulkTag: {
    method: "POST",
    path: "/api/contacts/bulk-tag",
    body: contactsBulkTagBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), updatedCount: z.number() }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk tag contacts",
  },
  widgetAggregates: {
    method: "POST",
    path: "/api/contacts/widget-aggregates",
    body: z.object({ widgets: z.array(z.unknown()) }),
    responses: {
      200: z.object({ results: z.record(z.string(), widgetAggregateResultSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get widget aggregates",
  },
  duplicateCheck: {
    method: "POST",
    path: "/api/contacts/duplicate-check",
    /**
     * The candidate is re-validated tenant-aware in the handler
     * (`buildContactDuplicateCheckBodySchema(extraKeys)`); here we only pin the
     * envelope, because custom fields and a partially filled draft are valid.
     */
    body: z.object({ contact: z.record(z.string(), z.unknown()) }).strict(),
    responses: {
      200: z.object({ matchCount: z.number() }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Check for duplicate contacts",
  },
} as const;
