import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { apiErrorResponseSchema } from "../core/apiSchemas.js";
import {
  workshopCertificatesBodySchema,
  workshopCompletionRowSchema,
  workshopPreferencesSchema,
  workshopReportRowSchema,
} from "../workshops/workshopCompletion.js";

const c = initContract();
const errorResponse = apiErrorResponseSchema;
const emptyQuery = z.object({}).strict();
const emptyBody = z.object({}).strict();
const idParams = z.object({ id: z.string().min(1).max(128) }).strict();

/** Workshops completion, certificates, Reports and Setup routes (split from `workshopsContract`). */
export const workshopsCompletionContract = c.router({
  getCompletion: {
    method: "GET",
    path: "/api/workshops/:id/completion",
    pathParams: idParams,
    query: emptyQuery,
    responses: {
      200: z.object({ rows: z.array(workshopCompletionRowSchema) }).strict(),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Each participant's standing against the completion criteria (nothing is written)",
  },
  evaluateCompletion: {
    method: "POST",
    path: "/api/workshops/:id/completion/evaluate",
    pathParams: idParams,
    query: emptyQuery,
    body: emptyBody.optional(),
    responses: {
      200: z.object({ rows: z.array(workshopCompletionRowSchema) }).strict(),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Evaluate and store every participant's completion",
  },
  issueCertificates: {
    method: "POST",
    path: "/api/workshops/:id/certificates",
    pathParams: idParams,
    query: emptyQuery,
    body: workshopCertificatesBodySchema,
    responses: {
      200: z
        .object({ issued: z.array(z.string()), rows: z.array(workshopCompletionRowSchema) })
        .strict(),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Mark participation certificates issued for completed participants",
  },
  getReport: {
    method: "GET",
    path: "/api/workshops/report",
    query: emptyQuery,
    responses: {
      200: z.object({ rows: z.array(workshopReportRowSchema) }).strict(),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Per-workshop participation, attendance and completion",
  },
  getPreferences: {
    method: "GET",
    path: "/api/workshops/setup/preferences",
    query: emptyQuery,
    responses: {
      200: workshopPreferencesSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Setup defaults for new workshops",
  },
  savePreferences: {
    method: "PUT",
    path: "/api/workshops/setup/preferences",
    query: emptyQuery,
    body: workshopPreferencesSchema,
    responses: {
      200: workshopPreferencesSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Save Setup defaults for new workshops",
  },
});
