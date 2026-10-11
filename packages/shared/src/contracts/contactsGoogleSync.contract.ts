import { z } from "zod";
import { googleSyncClientConfigResponseSchema } from "./contacts.contract.js";

/** Google Contacts sync configuration and run routes. */
export const contactsGoogleSyncRoutes = {
  getGoogleSyncConfig: {
    method: "GET",
    path: "/api/contacts/google-sync",
    responses: {
      200: z.object({ config: googleSyncClientConfigResponseSchema }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get Google Sync config",
  },
  updateGoogleSyncConfig: {
    method: "PUT",
    path: "/api/contacts/google-sync",
    body: z.unknown(),
    responses: {
      200: z.object({ config: googleSyncClientConfigResponseSchema }),
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Update Google Sync config",
  },
  logGoogleSyncAudit: {
    method: "POST",
    path: "/api/contacts/google-sync/audit",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Log Google Sync audit",
  },
  exchangeGoogleSyncOAuth: {
    method: "POST",
    path: "/api/contacts/google-sync/exchange",
    body: z.unknown(),
    responses: {
      200: z.object({ config: googleSyncClientConfigResponseSchema }),
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Exchange Google Sync OAuth code",
  },
  runGoogleSync: {
    method: "POST",
    path: "/api/contacts/google-sync/run",
    body: z.unknown(),
    responses: {
      200: z.object({
        total: z.number(),
        imported: z.number(),
        updated: z.number().optional(),
        skipped: z.number(),
        skippedName: z.number(),
        skippedUnique: z.number(),
      }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Run Google Sync",
  },
} as const;
