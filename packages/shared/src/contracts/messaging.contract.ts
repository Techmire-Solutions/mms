import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { baseListQuerySchema } from "../core/apiSchemas.js";
import { contactListPageResponseSchema } from "./contacts.contract.js";
import {
  messageRecordSchema,
  messagingRecipientsMatchResponseSchema,
  messagingRecipientsQuerySchema,
  messagingMetricsSchema,
} from "../schemas/messaging.dto.js";
import { messageTemplateSchema } from "../messaging/messagingTemplateSchemas.js";
import { messagingResolveResponseSchema } from "../messaging/messagingModuleManifest.js";
import { messagingPreferencesSchema } from "../messaging/messagingPreferencesSchemas.js";

const c = initContract();
const ok = z.unknown();

/** Envelope for paginated message-log list responses (`MessageLogsPageResult`). */
export const messagingLogsPageResponseSchema = z.object({
  logs: z.array(messageRecordSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  hasMore: z.boolean(),
});

/** `{ success: true }` acknowledgement. */
const messagingSuccessResponseSchema = z.object({ success: z.literal(true) });

/** POST /api/messaging/logs — number of log rows recorded. */
const messagingRecordedResponseSchema = z.object({ recorded: z.number() });

export const messagingContract = c.router({
  listLogs: {
    method: "GET",
    path: "/api/messaging/history",
    query: baseListQuerySchema,
    responses: { 200: messagingLogsPageResponseSchema, 403: ok, 500: ok },
    summary: "List message logs",
  },
  listTemplates: {
    method: "GET",
    path: "/api/messaging/templates",
    query: baseListQuerySchema,
    responses: { 200: z.object({ templates: z.array(messageTemplateSchema) }), 403: ok, 500: ok },
    summary: "List messaging templates",
  },
  listRecipients: {
    method: "GET",
    path: "/api/messaging/recipients",
    query: messagingRecipientsQuerySchema,
    responses: { 200: contactListPageResponseSchema, 403: ok, 500: ok },
    summary: "List message recipients",
  },
  getMetrics: {
    method: "GET",
    path: "/api/messaging/metrics",
    query: z
      .object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
      .optional(),
    responses: { 200: z.object({ metrics: messagingMetricsSchema }), 403: ok, 500: ok },
    summary: "Get messaging analytics metrics",
  },
  saveTemplate: {
    method: "POST",
    path: "/api/messaging/templates",
    body: ok,
    responses: {
      200: z.object({ template: messageTemplateSchema }),
      201: z.object({ template: messageTemplateSchema }),
      400: ok,
      403: ok,
      500: ok,
    },
    summary: "Create or update a message template",
  },
  deleteTemplate: {
    method: "DELETE",
    path: "/api/messaging/templates/:id",
    pathParams: z.object({ id: z.string() }),
    body: ok,
    responses: { 200: messagingSuccessResponseSchema, 400: ok, 403: ok, 500: ok },
    summary: "Delete a message template",
  },
  recordLogs: {
    method: "POST",
    path: "/api/messaging/logs",
    body: ok,
    responses: {
      200: messagingRecordedResponseSchema,
      201: messagingRecordedResponseSchema,
      400: ok,
      403: ok,
      409: ok,
      500: ok,
    },
    summary: "Record message dispatch logs",
  },
  clearLogs: {
    method: "DELETE",
    path: "/api/messaging/logs",
    body: ok,
    responses: { 200: messagingSuccessResponseSchema, 400: ok, 403: ok, 500: ok },
    summary: "Clear message logs",
  },
  resolveContacts: {
    method: "POST",
    path: "/api/messaging/contacts/resolve",
    body: z.object({ ids: z.array(z.string()) }),
    responses: { 200: messagingResolveResponseSchema, 403: ok, 500: ok },
    summary: "Resolve contacts by ids",
  },
  matchRecipients: {
    method: "GET",
    path: "/api/messaging/recipients/match",
    query: z.object({}).passthrough(),
    responses: { 200: messagingRecipientsMatchResponseSchema, 403: ok, 500: ok },
    summary: "Match recipients",
  },
  getPreferences: {
    method: "GET",
    path: "/api/messaging/preferences",
    responses: {
      200: z.object({ preferences: messagingPreferencesSchema }),
      403: ok,
      500: ok,
    },
    summary: "Get messaging preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/messaging/preferences",
    body: messagingPreferencesSchema,
    responses: {
      200: z.object({ success: z.literal(true), preferences: messagingPreferencesSchema }),
      403: ok,
      500: ok,
    },
    summary: "Update messaging preferences",
  },
});
