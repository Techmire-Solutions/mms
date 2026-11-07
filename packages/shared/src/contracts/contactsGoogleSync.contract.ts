import { z } from "zod";
import { googleSyncClientConfigResponseSchema } from "./contacts.contract.schemas.js";
import {
  contactGoogleSyncConfigSchema,
  contactGoogleSyncAuditSchema,
  contactGoogleSyncExchangeSchema,
} from "../schemas/contactsOperations.dto.js";

const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();

/** Google Contacts sync configuration and run routes. */
export const contactsGoogleSyncRoutes = {
  getGoogleSyncConfig: {
    method: "GET",
    path: "/api/contacts/google-sync",
    responses: {
      200: z.object({ config: googleSyncClientConfigResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get Google Sync config",
  },
  updateGoogleSyncConfig: {
    method: "PUT",
    path: "/api/contacts/google-sync",
    body: contactGoogleSyncConfigSchema,
    responses: {
      200: z.object({ config: googleSyncClientConfigResponseSchema }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update Google Sync config",
  },
  logGoogleSyncAudit: {
    method: "POST",
    path: "/api/contacts/google-sync/audit",
    body: contactGoogleSyncAuditSchema,
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Log Google Sync audit",
  },
  exchangeGoogleSyncOAuth: {
    method: "POST",
    path: "/api/contacts/google-sync/exchange",
    body: contactGoogleSyncExchangeSchema,
    responses: {
      200: z.object({ config: googleSyncClientConfigResponseSchema }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Exchange Google Sync OAuth code",
  },
  runGoogleSync: {
    method: "POST",
    path: "/api/contacts/google-sync/run",
    body: z.object({}).optional(),
    responses: {
      200: z.object({
        total: z.number(),
        imported: z.number(),
        updated: z.number().optional(),
        skipped: z.number(),
        skippedName: z.number(),
        skippedUnique: z.number(),
      }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Run Google Sync",
  },
} as const;
