import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  promotionPreviewRowSchema,
  sessionRolloverBodySchema,
  sessionRolloverRunSchema,
} from "../sessions/sessionRollover.js";
import { sessionErrorResponseSchema, sessionIdParamsSchema } from "./sessionContractShared.js";

const c = initContract();
const errorResponse = sessionErrorResponseSchema;
const sessionParams = sessionIdParamsSchema;
const writeErrors = {
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  500: errorResponse,
};

/** Year rollover (Phase 10): duplicate a session or promote its students into a new draft. */
export const sessionRolloverContract = c.router({
  preview: {
    method: "POST",
    path: "/api/sessions/:id/rollover/preview",
    pathParams: sessionParams,
    body: sessionRolloverBodySchema,
    responses: { 200: z.object({ rows: z.array(promotionPreviewRowSchema) }), ...writeErrors },
    summary: "Per-student outcome and eligibility problems of a rollover, without writing",
  },
  start: {
    method: "POST",
    path: "/api/sessions/:id/rollover",
    pathParams: sessionParams,
    body: sessionRolloverBodySchema,
    responses: { 202: z.object({ run: sessionRolloverRunSchema }), ...writeErrors },
    summary: "Queue a rollover run (background job) that creates the new draft session",
  },
  runs: {
    method: "GET",
    path: "/api/sessions/:id/rollover/runs",
    pathParams: sessionParams,
    responses: {
      200: z.object({ runs: z.array(sessionRolloverRunSchema) }),
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Recent rollover runs started from a session",
  },
});
