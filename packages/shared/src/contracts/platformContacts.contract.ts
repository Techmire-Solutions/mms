import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  platformContactCreateInputSchema,
  platformContactUpdateInputSchema,
  platformContactsListQuerySchema,
} from "../schemas/platformContacts.dto.js";

const c = initContract();

const ok = z.unknown();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const idParams = z.object({ id: z.string() });

/** Platform Console contact directory (operators + workspace admins + external). */
export const platformContactsContract = c.router({
  list: {
    method: "GET",
    path: "/api/platform/contacts",
    query: platformContactsListQuerySchema,
    responses: { 200: ok, 401: errorResponse, 403: errorResponse },
    summary: "List platform contacts",
  },
  metrics: {
    method: "GET",
    path: "/api/platform/contacts/metrics",
    responses: { 200: ok, 401: errorResponse, 403: errorResponse },
    summary: "Platform contact directory metrics",
  },
  create: {
    method: "POST",
    path: "/api/platform/contacts",
    body: platformContactCreateInputSchema,
    responses: { 201: ok, 400: errorResponse, 401: errorResponse, 403: errorResponse },
    summary: "Create an external platform contact",
  },
  get: {
    method: "GET",
    path: "/api/platform/contacts/:id",
    pathParams: idParams,
    responses: { 200: ok, 401: errorResponse, 403: errorResponse, 404: errorResponse },
    summary: "Get a platform contact",
  },
  update: {
    method: "PUT",
    path: "/api/platform/contacts/:id",
    pathParams: idParams,
    body: platformContactUpdateInputSchema,
    responses: {
      200: ok,
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
    summary: "Update a platform contact",
  },
  delete: {
    method: "DELETE",
    path: "/api/platform/contacts/:id",
    pathParams: idParams,
    body: z.unknown().optional(),
    responses: { 200: ok, 401: errorResponse, 403: errorResponse, 404: errorResponse },
    summary: "Soft-delete a platform contact",
  },
  restore: {
    method: "POST",
    path: "/api/platform/contacts/:id/restore",
    pathParams: idParams,
    body: z.unknown().optional(),
    responses: { 200: ok, 401: errorResponse, 403: errorResponse, 404: errorResponse },
    summary: "Restore a soft-deleted platform contact",
  },
});
