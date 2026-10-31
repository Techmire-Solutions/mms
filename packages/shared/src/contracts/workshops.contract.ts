import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
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
  workshopParticipantRecordSchema,
  workshopScoreRecordSchema,
  workshopScoresBodySchema,
  workshopsPageResponseSchema,
} from "../workshops/workshopsRecords.js";

const c = initContract();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const success = z.object({ success: z.literal(true) });

const idParams = z.object({ id: z.string().min(1) });
const participantParams = z.object({ id: z.string().min(1), participantId: z.string().min(1) });

export const workshopsContract = c.router({
  listWorkshops: {
    method: "GET",
    path: "/api/workshops",
    query: baseListQuerySchema,
    responses: { 200: workshopsPageResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "List workshops (active, or trash with includeDeleted)",
  },
  getWorkshop: {
    method: "GET",
    path: "/api/workshops/:id",
    pathParams: idParams,
    responses: {
      200: workshopDetailSchema,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Workshop with its participants, check-ins and scores",
  },
  createWorkshop: {
    method: "POST",
    path: "/api/workshops",
    body: workshopEventCreateSchema,
    responses: {
      201: z.object({ workshop: workshopEventRecordSchema }),
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
    body: workshopEventUpdateSchema,
    responses: {
      200: z.object({ workshop: workshopEventRecordSchema }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Update a workshop",
  },
  deleteWorkshop: {
    method: "DELETE",
    path: "/api/workshops/:id",
    pathParams: idParams,
    body: softDeleteBodySchema.optional(),
    responses: { 200: success, 403: errorResponse, 404: errorResponse, 500: errorResponse },
    summary: "Move a workshop to trash",
  },
  restoreWorkshop: {
    method: "POST",
    path: "/api/workshops/:id/restore",
    pathParams: idParams,
    body: z.object({}).optional(),
    responses: { 200: success, 403: errorResponse, 404: errorResponse, 500: errorResponse },
    summary: "Restore a workshop from trash",
  },
  bulkDeleteWorkshops: {
    method: "POST",
    path: "/api/workshops/bulk-delete",
    body: bulkStringIdsBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), succeeded: z.number(), failed: z.number() }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Move several workshops to trash",
  },
  addParticipant: {
    method: "POST",
    path: "/api/workshops/:id/participants",
    pathParams: idParams,
    body: workshopParticipantCreateSchema,
    responses: {
      201: z.object({ participant: workshopParticipantRecordSchema }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Register a contact (staff or external) for a workshop",
  },
  removeParticipant: {
    method: "DELETE",
    path: "/api/workshops/:id/participants/:participantId",
    pathParams: participantParams,
    body: z.object({}).optional(),
    responses: { 200: success, 403: errorResponse, 404: errorResponse, 500: errorResponse },
    summary: "Withdraw a participant",
  },
  saveAttendanceDay: {
    method: "PUT",
    path: "/api/workshops/:id/attendance",
    pathParams: idParams,
    body: workshopAttendanceDayBodySchema,
    responses: {
      200: z.object({ attendance: z.array(workshopAttendanceRecordSchema) }),
      400: errorResponse,
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
    body: workshopScoresBodySchema,
    responses: {
      200: z.object({ scores: z.array(workshopScoreRecordSchema) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Upsert score lines keyed by participant and criterion",
  },
});
