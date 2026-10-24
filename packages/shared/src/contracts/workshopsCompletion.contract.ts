import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  workshopCertificatesBodySchema,
  workshopCompletionRowSchema,
  workshopPreferencesSchema,
  workshopReportRowSchema,
} from "../workshops/workshopCompletion.js";

const c = initContract();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const idParams = z.object({ id: z.string().min(1) });

/** Workshops completion, certificates, Reports and Setup routes (split from `workshopsContract`). */
export const workshopsCompletionContract = c.router({
  getCompletion: {
    method: "GET",
    path: "/api/workshops/:id/completion",
    pathParams: idParams,
    responses: {
      200: z.object({ rows: z.array(workshopCompletionRowSchema) }),
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
    body: z.object({}).optional(),
    responses: {
      200: z.object({ rows: z.array(workshopCompletionRowSchema) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Evaluate and store every participant's completion",
  },
  issueCertificates: {
    method: "POST",
    path: "/api/workshops/:id/certificates",
    pathParams: idParams,
    body: workshopCertificatesBodySchema,
    responses: {
      200: z.object({ issued: z.array(z.string()), rows: z.array(workshopCompletionRowSchema) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Mark participation certificates issued for completed participants",
  },
  getReport: {
    method: "GET",
    path: "/api/workshops/report",
    responses: {
      200: z.object({ rows: z.array(workshopReportRowSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Per-workshop participation, attendance and completion",
  },
  getPreferences: {
    method: "GET",
    path: "/api/workshops/setup/preferences",
    responses: { 200: workshopPreferencesSchema, 403: errorResponse, 500: errorResponse },
    summary: "Setup defaults for new workshops",
  },
  savePreferences: {
    method: "PUT",
    path: "/api/workshops/setup/preferences",
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
