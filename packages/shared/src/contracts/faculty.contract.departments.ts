import { z } from "zod";
import {
  facultyDepartmentSchema,
  facultyDepartmentWriteSchema,
} from "../faculty/facultyDepartmentTypes.js";

const errorResponse = z.unknown();

export const facultyDepartmentContractEndpoints = {
  listDepartments: {
    method: "GET" as const,
    path: "/api/faculty/departments",
    query: z
      .object({
        includeDeleted: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
      })
      .optional(),
    responses: {
      200: z.object({ departments: z.array(facultyDepartmentSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List faculty department catalog entries",
  },
  restoreDepartment: {
    method: "POST" as const,
    path: "/api/faculty/departments/:id/restore",
    body: z.object({}).optional(),
    responses: {
      200: z.object({ department: facultyDepartmentSchema }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a soft-deleted faculty department",
  },
  saveDepartment: {
    method: "PUT" as const,
    path: "/api/faculty/departments/:id",
    body: facultyDepartmentWriteSchema,
    responses: {
      200: z.object({ department: facultyDepartmentSchema }),
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
    },
    summary: "Create or update a faculty department",
  },
  deleteDepartment: {
    method: "DELETE" as const,
    path: "/api/faculty/departments/:id",
    body: z.object({}).optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Soft-delete a faculty department (rejected when active assignments reference it)",
  },
};
