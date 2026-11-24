import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  sessionCertificatesBodySchema,
  sessionCompletionActionBodySchema,
  sessionCompletionRowSchema,
} from "../sessions/sessionCompletion.js";
import { sessionErrorResponseSchema, sessionIdParamsSchema } from "./sessionContractShared.js";

const c = initContract();
const errorResponse = sessionErrorResponseSchema;
const sessionParams = sessionIdParamsSchema;
const rowsResponse = z.object({ rows: z.array(sessionCompletionRowSchema) });
const errors = {
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  /** Completion/certificates outside the session window. */
  409: errorResponse,
  500: errorResponse,
};

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
    body: sessionCompletionActionBodySchema,
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
