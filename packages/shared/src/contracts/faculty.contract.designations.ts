import { z } from "zod";
import {
  facultyDesignationAssignmentSchema,
  facultyDesignationSchema,
  facultyDesignationWriteSchema,
} from "../faculty/facultyDesignationTypes.js";

const errorResponse = z.unknown();

export const facultyDesignationContractEndpoints = {
  listDesignations: {
    method: "GET" as const,
    path: "/api/faculty/designations",
    query: z
      .object({
        includeDeleted: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
      })
      .optional(),
    responses: {
      200: z.object({ designations: z.array(facultyDesignationSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List Faculty designation definitions",
  },
  restoreDesignation: {
    method: "POST" as const,
    path: "/api/faculty/designations/:id/restore",
    body: z.object({}).optional(),
    responses: {
      200: z.object({ designation: facultyDesignationSchema }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a soft-deleted Faculty designation definition",
  },
  saveDesignation: {
    method: "PUT" as const,
    path: "/api/faculty/designations/:id",
    body: facultyDesignationWriteSchema,
    responses: {
      200: z.object({ designation: facultyDesignationSchema }),
      400: errorResponse,
      403: errorResponse,
    },
    summary: "Create or update a Faculty designation definition",
  },
  deleteDesignation: {
    method: "DELETE" as const,
    path: "/api/faculty/designations/:id",
    body: z.object({}).optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Soft-delete a Faculty designation definition",
  },
  listDesignationHistory: {
    method: "GET" as const,
    path: "/api/faculty/:facultyId/designation-history",
    responses: {
      200: z.object({ assignments: z.array(facultyDesignationAssignmentSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List designation history projected from faculty_assignments",
  },
};
