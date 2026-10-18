import { z } from "zod";
import { contactLookupsMapResponseSchema } from "./contacts.contract.js";

/** Setup-tier field config, preferences, lookups, and field-usage routes. */
export const contactsSetupRoutes = {
  getFieldConfig: {
    method: "GET",
    path: "/api/contacts/field-config",
    responses: {
      200: z.object({ config: z.record(z.string(), z.unknown()).nullable() }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get contact field config",
  },
  updateFieldConfig: {
    method: "PUT",
    path: "/api/contacts/field-config",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true), config: z.record(z.string(), z.unknown()) }),
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Update contact field config",
  },
  getPreferences: {
    method: "GET",
    path: "/api/contacts/preferences",
    responses: {
      200: z.object({ preferences: z.record(z.string(), z.unknown()) }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get contact preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/contacts/preferences",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true), preferences: z.record(z.string(), z.unknown()) }),
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Update contact preferences",
  },
  getColumnPreferences: {
    method: "GET",
    path: "/api/contacts/column-preferences",
    responses: { 200: z.unknown(), 403: z.unknown(), 500: z.unknown() },
    summary: "Get contact column preferences",
  },
  updateColumnPreferences: {
    method: "PUT",
    path: "/api/contacts/column-preferences",
    body: z.object({ preferences: z.array(z.unknown()) }),
    responses: { 200: z.unknown(), 403: z.unknown(), 500: z.unknown() },
    summary: "Update contact column preferences",
  },
  getLookups: {
    method: "GET",
    path: "/api/contacts/lookups",
    responses: {
      200: z.object({ lookups: contactLookupsMapResponseSchema }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get contact lookups",
  },
  updateLookups: {
    method: "PUT",
    path: "/api/contacts/lookups/:kind",
    pathParams: z.object({ kind: z.string() }),
    body: z.unknown(),
    responses: {
      200: z.object({
        success: z.literal(true),
        kind: z.string(),
        items: z.array(z.union([z.string(), z.object({ country: z.string(), code: z.string() })])),
        mirroredFromPrefs: z.boolean().optional(),
      }),
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Update contact lookups",
  },
  getFieldUsage: {
    method: "GET",
    path: "/api/contacts/field-usage/:fieldId",
    pathParams: z.object({ fieldId: z.string() }),
    responses: { 200: z.unknown(), 500: z.unknown() },
    summary: "Get single field usage count",
  },
  getFieldsUsage: {
    method: "POST",
    path: "/api/contacts/field-usage",
    body: z.object({ fieldKeys: z.array(z.string()) }),
    responses: { 200: z.unknown(), 500: z.unknown() },
    summary: "Get multiple fields usage counts",
  },
} as const;
