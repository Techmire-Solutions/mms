import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  apiErrorResponseSchema,
  baseListQuerySchema,
  bulkStringIdsBodySchema,
  softDeleteBodySchema,
} from "../core/apiSchemas.js";
import {
  workshopAttendanceDayBodySchema,
  workshopAttendanceRecordSchema,
  workshopDetailSchema,
  workshopEventCreateSchema,
  workshopEventRecordSchema,
  workshopEventUpdateSchema,
  workshopParticipantCreateSchema,
  workshopParticipantSummarySchema,
  workshopParticipantsBulkCreateSchema,
  workshopParticipantsImportSchema,
  workshopScoreRecordSchema,
  workshopScoresBodySchema,
  workshopsPageResponseSchema,
} from "../workshops/workshopsRecords.js";
import {
  workshopOccHeadersSchema,
  workshopTransitionBodySchema,
} from "../workshops/workshopLifecycleSchemas.js";
const c = initContract();
const errorResponse = apiErrorResponseSchema;
const success = z.object({ success: z.literal(true) }).strict();
const emptyQuery = z.object({}).strict();
const emptyBody = z.object({}).strict();
const idParams = z.object({ id: z.string().min(1).max(128) }).strict();
const jobEnvelope = z
  .object({
    job: z
      .object({
        id: z.string(),
        moduleId: z.string(),
        kind: z.string(),
        status: z.string(),
        label: z.string(),
      })
      .passthrough(),
  })
  .strict();
const participantParams = z
  .object({ id: z.string().min(1).max(128), participantId: z.string().min(1).max(128) })
  .strict();
/** The fields `listWorkshopsPage` actually sorts on; anything else is a 400, not a silent fallback. */
export const WORKSHOP_LIST_SORT_FIELDS = [
  "title",
  "startDate",
  "endDate",
  "registrationDeadline",
  "capacity",
  "updatedAt",
] as const;
/**
 * Strict list query for workshops. Deliberately drops the shared `afterId`/`skipCount` fields —
 * the workshop list has no cursor response and the repository never read them, so advertising them
 * was a silent no-op.
 */
export const workshopListQuerySchema = baseListQuerySchema
  .pick({ page: true, limit: true, search: true, sortDir: true, includeDeleted: true })
  .extend({ sortField: z.enum(WORKSHOP_LIST_SORT_FIELDS).optional() })
  .strict();
export const workshopsContract = c.router({
  listWorkshops: {
    method: "GET",
    path: "/api/workshops",
    query: workshopListQuerySchema,
    responses: {
      200: workshopsPageResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List workshops (active, or trash with includeDeleted)",
  },
  getWorkshop: {
    method: "GET",
    path: "/api/workshops/:id",
    pathParams: idParams,
    query: emptyQuery,
    responses: {
      200: workshopDetailSchema,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Workshop with its participants, check-ins and scores",
  },
  createWorkshop: {
    method: "POST",
    path: "/api/workshops",
    query: emptyQuery,
    body: workshopEventCreateSchema,
    responses: {
      201: z.object({ workshop: workshopEventRecordSchema }).strict(),
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Create a workshop",
  },
  updateWorkshop: {
    method: "PATCH",
    path: "/api/workshops/:id",
    pathParams: idParams,
    query: emptyQuery,
    body: workshopEventUpdateSchema,
    responses: {
      200: z.object({ workshop: workshopEventRecordSchema }).strict(),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      // Capacity cannot be lowered below the active registrations the seat check already counted.
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Update a workshop",
  },
  transitionWorkshop: {
    method: "POST",
    path: "/api/workshops/:id/transition",
    pathParams: idParams,
    query: emptyQuery,
    headers: workshopOccHeadersSchema,
    body: workshopTransitionBodySchema,
    responses: {
      200: z.object({ workshop: workshopEventRecordSchema }).strict(),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      428: errorResponse,
      500: errorResponse,
    },
    summary:
      "Publish, unpublish, complete or cancel a workshop (the only way its lifecycle status moves)",
  },
  deleteWorkshop: {
    method: "DELETE",
    path: "/api/workshops/:id",
    pathParams: idParams,
    query: emptyQuery,
    body: softDeleteBodySchema.optional(),
    responses: {
      200: success,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Move a workshop to trash",
  },
  restoreWorkshop: {
    method: "POST",
    path: "/api/workshops/:id/restore",
    pathParams: idParams,
    query: emptyQuery,
    body: emptyBody.optional(),
    responses: {
      200: success,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a workshop from trash",
  },
  bulkDeleteWorkshops: {
    method: "POST",
    path: "/api/workshops/bulk-delete",
    query: emptyQuery,
    body: bulkStringIdsBodySchema,
    responses: {
      200: z
        .object({ success: z.literal(true), succeeded: z.number(), failed: z.number() })
        .strict(),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Move several workshops to trash",
  },
  addParticipant: {
    method: "POST",
    path: "/api/workshops/:id/participants",
    pathParams: idParams,
    query: emptyQuery,
    body: workshopParticipantCreateSchema,
    responses: {
      201: z.object({ participant: workshopParticipantSummarySchema }).strict(),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Register a contact (staff or external) for a workshop",
  },
  addParticipants: {
    method: "POST",
    path: "/api/workshops/:id/participants/bulk",
    pathParams: idParams,
    query: emptyQuery,
    body: workshopParticipantsBulkCreateSchema,
    responses: {
      201: z
        .object({
          added: z.array(workshopParticipantSummarySchema),
          waitlisted: z.array(workshopParticipantSummarySchema),
        })
        .strict(),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary:
      "Register several contacts atomically; overflow joins the waitlist when the workshop has one",
  },
  importParticipants: {
    method: "POST",
    path: "/api/workshops/:id/participants/import",
    pathParams: idParams,
    query: emptyQuery,
    body: workshopParticipantsImportSchema,
    responses: {
      202: jobEnvelope,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
      503: errorResponse,
    },
    summary:
      "Queue a large participant import (1–5,000 contacts); returns the background job to track",
  },
  removeParticipant: {
    method: "DELETE",
    path: "/api/workshops/:id/participants/:participantId",
    pathParams: participantParams,
    query: emptyQuery,
    body: emptyBody.optional(),
    responses: {
      200: z
        .object({
          success: z.literal(true),
          /** The queued participant moved into the freed seat, when one existed. */
          promoted: workshopParticipantSummarySchema.nullable(),
        })
        .strict(),
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Withdraw a participant (promotes the oldest waitlisted row into the freed seat)",
  },
  saveAttendanceDay: {
    method: "PUT",
    path: "/api/workshops/:id/attendance",
    pathParams: idParams,
    query: emptyQuery,
    body: workshopAttendanceDayBodySchema,
    responses: {
      200: z.object({ attendance: z.array(workshopAttendanceRecordSchema) }).strict(),
      400: errorResponse,
      409: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Upsert one day of check-ins",
  },
  saveScores: {
    method: "PUT",
    path: "/api/workshops/:id/scores",
    pathParams: idParams,
    query: emptyQuery,
    body: workshopScoresBodySchema,
    responses: {
      200: z.object({ scores: z.array(workshopScoreRecordSchema) }).strict(),
      400: errorResponse,
      409: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Upsert score lines keyed by participant and criterion",
  },
});
