import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  sessionCertificatesBodySchema,
  sessionCompletionRowSchema,
} from "../sessions/sessionCompletion.js";

const c = initContract();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const sessionParams = z.object({ id: z.string().min(1).max(64) });
const rowsResponse = z.object({ rows: z.array(sessionCompletionRowSchema) });
const errors = { 400: errorResponse, 403: errorResponse, 404: errorResponse, 500: errorResponse };

/** Short-course completion (Phase 11): standing, evaluation and certificates. */
export const sessionCompletionContract = c.router({
  list: {
    method: "GET",
    path: "/api/sessions/:id/completion",
    pathParams: sessionParams,
    responses: { 200: rowsResponse, ...errors },
    summary: "Completion standing of every enrollment against the session criteria",
  },
  evaluate: {
    method: "POST",
    path: "/api/sessions/:id/completion/evaluate",
    pathParams: sessionParams,
    body: z.object({}).strict(),
    responses: { 200: rowsResponse, ...errors },
    summary: "Evaluate and store completion for every enrollment of the session",
  },
  certificates: {
    method: "POST",
    path: "/api/sessions/:id/completion/certificates",
    pathParams: sessionParams,
    body: sessionCertificatesBodySchema,
    responses: {
      200: z.object({ issued: z.array(z.string()), rows: z.array(sessionCompletionRowSchema) }),
      ...errors,
    },
    summary: "Mark certificates issued for completed enrollments",
  },
});
