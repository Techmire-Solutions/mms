import { z } from "zod";
import {
  facultyAssignmentSchema,
  facultyAssignmentTreeNodeSchema,
  facultyAssignmentWriteSchema,
} from "../faculty/facultyDepartmentTypes.js";

const errorResponse = z.unknown();

export const facultyAssignmentContractEndpoints = {
  listAssignments: {
    method: "GET" as const,
    path: "/api/faculty/:facultyId/assignments",
    query: z
      .object({
        activeOnly: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
      })
      .optional(),
    responses: {
      200: z.object({ assignments: z.array(facultyAssignmentSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List faculty multi-role temporal assignments",
  },
  saveAssignment: {
    method: "PUT" as const,
    path: "/api/faculty/:facultyId/assignments/:id",
    body: facultyAssignmentWriteSchema,
    responses: {
      200: z.object({ assignment: facultyAssignmentSchema }),
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
    },
    summary: "Create or update a faculty assignment",
  },
  closeAssignment: {
    method: "POST" as const,
    path: "/api/faculty/:facultyId/assignments/:id/close",
    body: z
      .object({
        endDate: z.iso.date(),
      })
      .strict(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
    summary: "Close an open faculty assignment with an end date",
  },
  deleteAssignment: {
    method: "DELETE" as const,
    path: "/api/faculty/:facultyId/assignments/:id",
    body: z.object({}).optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Soft-delete a faculty assignment",
  },
  getAssignmentSubordinates: {
    method: "GET" as const,
    path: "/api/faculty/assignments/:id/subordinates",
    responses: {
      200: z.object({ tree: z.array(facultyAssignmentTreeNodeSchema) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Downward subordinate tree traversal via recursive CTE",
  },
  getAssignmentManagerChain: {
    method: "GET" as const,
    path: "/api/faculty/assignments/:id/managers",
    responses: {
      200: z.object({ chain: z.array(facultyAssignmentTreeNodeSchema) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Upward supervisor manager chain traversal via recursive CTE",
  },
};
