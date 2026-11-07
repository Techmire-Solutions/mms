import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  sessionErrorResponseSchema,
  sessionIdParamsSchema,
  sessionResponseSchema,
} from "./sessionContractShared.js";
import { sessionOccHeadersSchema } from "./sessions.contract.js";
import {
  sessionActivityItemSchema,
  sessionCancelBodySchema,
  sessionCancelResultSchema,
  sessionPostponeBodySchema,
} from "../sessions/sessionLifecycleOps.js";

const c = initContract();
const errorResponse = sessionErrorResponseSchema;
const sessionParams = sessionIdParamsSchema;
const writeErrors = {
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  /** Lifecycle guard refused the transition (violations in the body). */
  409: errorResponse,
  /** No concurrency token supplied: a conditional action is required. */
  428: errorResponse,
  500: errorResponse,
};

/** Session-level lifecycle actions (Phase 9e) and the read-only activity timeline. */
export const sessionLifecycleOpsContract = c.router({
  cancel: {
    method: "POST",
    path: "/api/sessions/:id/cancel",
    pathParams: sessionParams,
    headers: sessionOccHeadersSchema,
    body: sessionCancelBodySchema,
    responses: { 200: sessionCancelResultSchema, ...writeErrors },
    summary:
      "Cancel a session; its live enrollments are cancelled and unpaid later invoices voided",
  },
  postpone: {
    method: "POST",
    path: "/api/sessions/:id/postpone",
    pathParams: sessionParams,
    headers: sessionOccHeadersSchema,
    body: sessionPostponeBodySchema,
    responses: { 200: z.object({ session: sessionResponseSchema }), ...writeErrors },
    summary: "Move a not-yet-started session to a new start date (end shifts by the same days)",
  },
  activity: {
    method: "GET",
    path: "/api/sessions/:id/activity",
    pathParams: sessionParams,
    responses: {
      200: z.object({ items: z.array(sessionActivityItemSchema) }),
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Dated activity of a session (enrollment changes, staff, sections, calendar)",
  },
});
