import { z } from "zod";
import { contactLookupsMapResponseSchema } from "./contacts.contract.schemas.js";
import {
  contactFieldConfigPutBodySchema,
  contactPreferencesPutBodySchema,
} from "../contacts/contactSetupConfigTypes.js";
import {
  contactLookupKindParamsSchema,
  contactLookupPutBodySchema,
} from "../contacts/contactLookupTypes.js";
import {
  contactFieldUsageBatchBodySchema,
  contactFieldUsageParamsSchema,
} from "../contacts/contactFieldUsage.js";
import {
  moduleColumnPreferencesBodySchema,
  moduleColumnPreferencesResponseSchema,
} from "../schemas/moduleColumnPreferences.dto.js";

const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();

/** Setup-tier field config, preferences, lookups, and field-usage routes. */
export const contactsSetupRoutes = {
  getFieldConfig: {
    method: "GET",
    path: "/api/contacts/field-config",
    responses: {
      200: z.object({ config: z.record(z.string(), z.unknown()).nullable() }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get contact field config",
  },
  updateFieldConfig: {
    method: "PUT",
    path: "/api/contacts/field-config",
    body: contactFieldConfigPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), config: z.record(z.string(), z.unknown()) }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update contact field config",
  },
  getPreferences: {
    method: "GET",
    path: "/api/contacts/preferences",
    responses: {
      200: z.object({ preferences: z.record(z.string(), z.unknown()) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get contact preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/contacts/preferences",
    body: contactPreferencesPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), preferences: z.record(z.string(), z.unknown()) }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update contact preferences",
  },
  getColumnPreferences: {
    method: "GET",
    path: "/api/contacts/column-preferences",
    responses: { 200: moduleColumnPreferencesResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "Get contact column preferences",
  },
  updateColumnPreferences: {
    method: "PUT",
    path: "/api/contacts/column-preferences",
    body: moduleColumnPreferencesBodySchema,
    responses: { 200: moduleColumnPreferencesResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "Update contact column preferences",
  },
  getLookups: {
    method: "GET",
    path: "/api/contacts/lookups",
    responses: {
      200: z.object({ lookups: contactLookupsMapResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get contact lookups",
  },
  updateLookups: {
    method: "PUT",
    path: "/api/contacts/lookups/:kind",
    pathParams: contactLookupKindParamsSchema,
    body: contactLookupPutBodySchema,
    responses: {
      200: z.object({
        success: z.literal(true),
        kind: z.string(),
        items: z.array(z.union([z.string(), z.object({ country: z.string(), code: z.string() })])),
        mirroredFromPrefs: z.boolean().optional(),
      }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update contact lookups",
  },
  getFieldUsage: {
    method: "GET",
    path: "/api/contacts/field-usage/:fieldKey",
    pathParams: contactFieldUsageParamsSchema,
    responses: { 200: z.object({ count: z.number() }), 403: errorResponse, 500: errorResponse },
    summary: "Get single field usage count",
  },
  getFieldsUsage: {
    method: "POST",
    path: "/api/contacts/field-usage",
    body: contactFieldUsageBatchBodySchema,
    responses: { 200: z.object({ counts: z.record(z.string(), z.number()) }), 403: errorResponse, 500: errorResponse },
    summary: "Get multiple fields usage counts",
  },
} as const;
