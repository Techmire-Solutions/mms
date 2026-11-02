import { z } from "zod";
import { contactRecordSchema } from "../contacts/contactsModuleManifest.js";
import { contactsBulkTagBodySchema } from "../contacts/contactEntityTypes.js";
import {
  contactIdentityMatchBodySchema,
  contactIdentityMatchResultSchema,
} from "../contacts/contactIdentityMatch.js";
import { includeDeletedQuerySchema, softDeleteBodySchema } from "../core/apiSchemas.js";
import { contactsListQuerySchema } from "../contacts/contactsListQuery.js";
import { contactWireWriteSchema } from "../schemas/contacts.dto.js";
import { widgetAggregateResultSchema } from "../schemas/common.dto.js";
import {
  contactListPageResponseSchema,
  contactBulkResultResponseSchema,
  contactWrappedResponseSchema,
} from "./contacts.contract.schemas.js";

const responseWrapper = contactWrappedResponseSchema;
const bulkResult = contactBulkResultResponseSchema;

const contactBulkRestoreResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
  conflicts: z.array(
    z.object({
      id: z.string(),
      errors: z.array(z.object({ field: z.string(), message: z.string() })),
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
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "List contacts",
  },
  create: {
    method: "POST",
    path: "/api/contacts",
    body: contactWireWriteSchema,
    responses: {
      200: responseWrapper,
      201: responseWrapper,
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Create a new contact",
  },
  get: {
    method: "GET",
    path: "/api/contacts/:id",
    pathParams: z.object({ id: z.string() }),
    query: includeDeletedQuerySchema.optional(),
    responses: {
      200: z.object({ contact: contactRecordSchema }),
      403: z.unknown(),
      404: z.unknown(),
      500: z.unknown(),
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
      400: z.unknown(),
      403: z.unknown(),
      404: z.unknown(),
      409: z.object({ type: z.literal("conflict"), message: z.string() }),
      500: z.unknown(),
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
      403: z.unknown(),
      404: z.unknown(),
      500: z.unknown(),
    },
    summary: "Delete a contact",
  },
  restore: {
    method: "POST",
    path: "/api/contacts/:id/restore",
    body: z.unknown(),
    responses: { 200: responseWrapper, 404: z.unknown(), 500: z.unknown() },
    summary: "Restore a contact",
  },
  bulkDelete: {
    method: "POST",
    path: "/api/contacts/bulk-delete",
    body: z.object({ ids: z.array(z.string()), deletionReason: z.string().optional() }),
    responses: { 200: bulkResult, 500: z.unknown() },
    summary: "Bulk delete contacts",
  },
  bulkRestore: {
    method: "POST",
    path: "/api/contacts/bulk-restore",
    body: z.object({ ids: z.array(z.string()) }),
    responses: { 200: contactBulkRestoreResponseSchema, 500: z.unknown() },
    summary: "Bulk restore contacts",
  },
  exportAudit: {
    method: "POST",
    path: "/api/contacts/export-audit",
    body: z.object({ count: z.number(), scope: z.enum(["all", "filtered", "selection"]) }),
    responses: { 200: z.object({ success: z.literal(true) }), 500: z.unknown() },
    summary: "Log export audit",
  },
  setupAudit: {
    method: "POST",
    path: "/api/contacts/setup-audit",
    body: z.object({ area: z.enum(["fields", "preferences"]), summary: z.string() }),
    responses: { 200: z.object({ success: z.literal(true) }), 500: z.unknown() },
    summary: "Log setup audit",
  },
  resolve: {
    method: "POST",
    path: "/api/contacts/resolve",
    body: z.object({ ids: z.array(z.string()) }),
    responses: { 200: z.object({ contacts: z.array(contactRecordSchema) }), 500: z.unknown() },
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
    responses: { 200: responseWrapper, 400: z.unknown(), 500: z.unknown() },
    summary: "Merge contacts",
  },
  identityMatch: {
    method: "POST",
    path: "/api/contacts/identity-match",
    body: contactIdentityMatchBodySchema,
    responses: { 200: contactIdentityMatchResultSchema, 400: z.unknown(), 500: z.unknown() },
    summary: "Match contact identity",
  },
  bulkTag: {
    method: "POST",
    path: "/api/contacts/bulk-tag",
    body: contactsBulkTagBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), updatedCount: z.number() }),
      500: z.unknown(),
    },
    summary: "Bulk tag contacts",
  },
  widgetAggregates: {
    method: "POST",
    path: "/api/contacts/widget-aggregates",
    body: z.object({ widgets: z.array(z.unknown()) }),
    responses: {
      200: z.object({ results: z.record(z.string(), widgetAggregateResultSchema) }),
      403: z.unknown(),
      500: z.unknown(),
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
    responses: { 200: z.object({ matchCount: z.number() }), 500: z.unknown() },
    summary: "Check for duplicate contacts",
  },
} as const;
