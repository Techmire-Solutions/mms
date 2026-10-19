import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { SessionSchema } from "../sessions/sessionTypes.js";
import {
  sessionActivityItemSchema,
  sessionCancelBodySchema,
  sessionCancelResultSchema,
  sessionPostponeBodySchema,
} from "../sessions/sessionLifecycleOps.js";

const c = initContract();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const sessionParams = z.object({ id: z.string().min(1).max(64) });
const writeErrors = {
  400: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  500: errorResponse,
};

/** Session-level lifecycle actions (Phase 9e) and the read-only activity timeline. */
export const sessionLifecycleOpsContract = c.router({
  cancel: {
    method: "POST",
    path: "/api/sessions/:id/cancel",
    pathParams: sessionParams,
    body: sessionCancelBodySchema,
    responses: { 200: sessionCancelResultSchema, ...writeErrors },
    summary:
      "Cancel a session; its live enrollments are cancelled and unpaid later invoices voided",
  },
  postpone: {
    method: "POST",
    path: "/api/sessions/:id/postpone",
    pathParams: sessionParams,
    body: sessionPostponeBodySchema,
    responses: { 200: z.object({ session: SessionSchema }), ...writeErrors },
    summary: "Move a not-yet-started session to a new start date (end shifts by the same days)",
  },
  activity: {
    method: "GET",
    path: "/api/sessions/:id/activity",
    pathParams: sessionParams,
    responses: {
      200: z.object({ items: z.array(sessionActivityItemSchema) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Dated activity of a session (enrollment changes, staff, sections, calendar)",
  },
});
