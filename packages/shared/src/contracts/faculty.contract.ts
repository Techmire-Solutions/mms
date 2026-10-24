import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  facultyRecordSchema,
  facultyBulkStatusSchema,
  facultyBulkSpecializationSchema,
  facultyNextEmployeeIdQuerySchema,
} from "../faculty/facultyModuleManifest.js";
import { facultyListQuerySchema } from "../faculty/facultyListQuery.js";
import { facultyWriteSchema, facultyDuplicateCheckBodySchema } from "../schemas/faculty.dto.js";
import {
  facultyBulkResultResponseSchema,
  facultyListPageResponseSchema,
  facultyPreferencesResponseSchema,
  facultyWidgetAggregateResultSchema,
  facultyWrappedResponseSchema,
} from "./faculty.contract.schemas.js";
import { facultyDesignationContractEndpoints } from "./faculty.contract.designations.js";
import { facultySetupContractEndpoints } from "./faculty.contract.setup.js";
import { facultyDepartmentContractEndpoints } from "./faculty.contract.departments.js";
import { facultyAssignmentContractEndpoints } from "./faculty.contract.assignments.js";

export { facultyListPageResponseSchema, facultyPreferencesResponseSchema };

const c = initContract();
const errorResponse = z.unknown();

export const facultyContract = c.router({
  list: {
    method: "GET",
    path: "/api/faculty",
    query: facultyListQuerySchema,
    responses: { 200: facultyListPageResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "List faculty members",
  },
  get: {
    method: "GET",
    path: "/api/faculty/:id",
    query: z
      .object({
        includeDeleted: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
      })
      .optional(),
    responses: {
      200: z.object({
        faculty: facultyRecordSchema.optional(),
        facultyMember: facultyRecordSchema.optional(),
      }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Get a single faculty member",
  },
  create: {
    method: "POST",
    path: "/api/faculty",
    body: facultyWriteSchema,
    responses: {
      200: facultyWrappedResponseSchema,
      201: facultyWrappedResponseSchema,
      403: errorResponse,
      400: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Create a faculty member",
  },
  update: {
    method: "PUT",
    path: "/api/faculty/:id",
    body: facultyWriteSchema,
    responses: {
      200: facultyWrappedResponseSchema,
      403: errorResponse,
      404: errorResponse,
      400: errorResponse,
      500: errorResponse,
    },
    summary: "Update a faculty member",
  },
  delete: {
    method: "DELETE",
    path: "/api/faculty/:id",
    body: z
      .object({
        deletionReason: z.string().optional(),
        reassignSubordinatesTo: z.string().optional(),
      })
      .optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Soft delete a faculty member",
  },
  hierarchyTree: {
    method: "GET",
    path: "/api/faculty/hierarchy-tree",
    responses: {
      200: z.object({
        nodes: z.array(z.record(z.string(), z.unknown())),
      }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get organizational faculty hierarchy tree",
  },
  bulkStatus: {
    method: "POST",
    path: "/api/faculty/bulk-status",
    body: facultyBulkStatusSchema,
    responses: {
      200: facultyBulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk update faculty status",
  },
  bulkSpecialization: {
    method: "POST",
    path: "/api/faculty/bulk-specialization",
    body: facultyBulkSpecializationSchema,
    responses: {
      200: facultyBulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk update faculty specialization",
  },
  duplicateCheck: {
    method: "POST",
    path: "/api/faculty/duplicate-check",
    body: facultyDuplicateCheckBodySchema,
    responses: {
      200: z.object({ reason: z.enum(["contact", "employeeId"]).nullable() }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Check for duplicate faculty registration",
  },
  nextEmployeeId: {
    method: "GET",
    path: "/api/faculty/next-employee-id",
    query: facultyNextEmployeeIdQuerySchema,
    responses: {
      200: z.object({ employeeId: z.string() }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get next available employee ID",
  },
  migrateEmployeeIds: {
    method: "POST",
    path: "/api/faculty/migrate-employee-ids",
    body: z.object({}).optional(),
    responses: {
      200: z.object({ success: z.literal(true), updated: z.number() }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Migrate faculty missing employee IDs",
  },
  restore: {
    method: "POST",
    path: "/api/faculty/:id/restore",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a soft-deleted faculty member",
  },
  bulkDelete: {
    method: "POST",
    path: "/api/faculty/bulk-delete",
    body: z.object({
      ids: z.array(z.union([z.string(), z.number()])),
      deletionReason: z.string().optional(),
    }),
    responses: { 200: facultyBulkResultResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "Bulk delete faculty members",
  },
  bulkRestore: {
    method: "POST",
    path: "/api/faculty/bulk-restore",
    body: z.object({ ids: z.array(z.union([z.string(), z.number()])) }),
    responses: { 200: facultyBulkResultResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "Bulk restore faculty members",
  },
  exportAudit: {
    method: "POST",
    path: "/api/faculty/export-audit",
    body: z.object({ count: z.number(), scope: z.enum(["all", "filtered", "selection"]) }),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Log export audit",
  },
  resolve: {
    method: "POST",
    path: "/api/faculty/resolve",
    body: z.object({ ids: z.array(z.string()) }),
    responses: {
      200: z.object({ faculty: z.array(facultyRecordSchema).optional() }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Resolve faculty members by IDs",
  },
  linkedContactIds: {
    method: "GET",
    path: "/api/faculty/linked-contact-ids",
    query: z.object({ excludeId: z.string().optional() }).optional(),
    responses: {
      200: z.object({ contactIds: z.array(z.union([z.string(), z.number()])) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get linked contact IDs",
  },
  widgetAggregates: {
    method: "POST",
    path: "/api/faculty/widget-aggregates",
    body: z.object({ widgets: z.array(z.unknown()) }),
    responses: {
      200: z.object({ results: z.record(z.string(), facultyWidgetAggregateResultSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get widget aggregates",
  },
  ...facultyDesignationContractEndpoints,
  ...facultyDepartmentContractEndpoints,
  ...facultyAssignmentContractEndpoints,
  ...facultySetupContractEndpoints,
});
