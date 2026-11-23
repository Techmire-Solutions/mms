import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  platformMessageSendInputSchema,
  platformMessagesListQuerySchema,
  platformMessageTemplateSaveInputSchema,
} from "../schemas/platformMessaging.dto.js";

const c = initContract();

const ok = z.unknown();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const idParams = z.object({ id: z.string() });

/** Platform Console broadcast messaging + templates. */
export const platformMessagingContract = c.router({
  listMessages: {
    method: "GET",
    path: "/api/platform/messages",
    query: platformMessagesListQuerySchema,
    responses: { 200: ok, 401: errorResponse, 403: errorResponse },
    summary: "List platform messages",
  },
  metrics: {
    method: "GET",
    path: "/api/platform/messages/metrics",
    responses: { 200: ok, 401: errorResponse, 403: errorResponse },
    summary: "Platform messaging metrics",
  },
  send: {
    method: "POST",
    path: "/api/platform/messages",
    body: platformMessageSendInputSchema,
    responses: { 201: ok, 400: errorResponse, 401: errorResponse, 403: errorResponse },
    summary: "Send a platform broadcast message",
  },
  listTemplates: {
    method: "GET",
    path: "/api/platform/messages/templates",
    responses: { 200: ok, 401: errorResponse, 403: errorResponse },
    summary: "List platform message templates",
  },
  saveTemplate: {
    method: "PUT",
    path: "/api/platform/messages/templates/:id",
    pathParams: idParams,
    body: platformMessageTemplateSaveInputSchema,
    responses: { 200: ok, 400: errorResponse, 401: errorResponse, 403: errorResponse },
    summary: "Create or replace a platform message template",
  },
  deleteTemplate: {
    method: "DELETE",
    path: "/api/platform/messages/templates/:id",
    pathParams: idParams,
    body: z.unknown().optional(),
    responses: { 200: ok, 401: errorResponse, 403: errorResponse, 404: errorResponse },
    summary: "Delete a platform message template",
  },
});
