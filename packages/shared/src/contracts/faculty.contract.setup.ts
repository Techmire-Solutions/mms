import { z } from "zod";
import { facultyLookupsMapSchema } from "../facultyLookupTypes.js";
import { facultyPreferencesResponseSchema } from "./faculty.contract.schemas.js";

const errorResponse = z.unknown();

export const facultySetupContractEndpoints = {
  setupAudit: {
    method: "POST" as const,
    path: "/api/faculty/setup-audit",
    body: z.object({ area: z.enum(["fields", "preferences"]), summary: z.string() }),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Log setup audit",
  },
  getFieldConfig: {
    method: "GET" as const,
    path: "/api/faculty/field-config",
    responses: {
      200: z.object({ config: z.record(z.string(), z.unknown()).nullable() }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get field config",
  },
  updateFieldConfig: {
    method: "PUT" as const,
    path: "/api/faculty/field-config",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true), config: z.record(z.string(), z.unknown()) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update field config",
  },
  getPreferences: {
    method: "GET" as const,
    path: "/api/faculty/preferences",
    responses: {
      200: z.object({ preferences: facultyPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get preferences",
  },
  updatePreferences: {
    method: "PUT" as const,
    path: "/api/faculty/preferences",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true), preferences: facultyPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update preferences",
  },
  getLookups: {
    method: "GET" as const,
    path: "/api/faculty/lookups",
    responses: {
      200: z.object({ lookups: facultyLookupsMapSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get all lookups",
  },
  getLookupKind: {
    method: "GET" as const,
    path: "/api/faculty/lookups/:kind",
    responses: { 200: z.unknown(), 403: errorResponse, 500: errorResponse },
    summary: "Get a specific lookup kind",
  },
  updateLookupKind: {
    method: "PUT" as const,
    path: "/api/faculty/lookups/:kind",
    body: z.object({ items: z.array(z.string()) }),
    responses: {
      200: z.object({ success: z.literal(true), kind: z.string(), items: z.array(z.string()) }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update a specific lookup kind",
  },
};
