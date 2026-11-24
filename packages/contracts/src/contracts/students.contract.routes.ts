import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { apiErrorResponseSchema } from "../schemas/api.dto.js";
import {
  studentWireWriteSchema,
  studentsBulkEnrollBodySchema,
  studentsDuplicateCheckBodySchema,
  studentsBulkStatusSchema,
} from "../schemas/students.dto.js";
import { studentRecordSchema } from "../students/studentsModuleManifest.js";
import {
  studentsListQuerySchema,
  studentsNextGrNumberQuerySchema,
} from "../students/studentsListQuery.js";
import { includeDeletedQuerySchema } from "../core/apiSchemas.js";

export { studentRecordSchema, studentsListQuerySchema, studentsNextGrNumberQuerySchema };

const c = initContract();

const errorResponse = apiErrorResponseSchema;

/**
 * Hydrated student record schema for API read responses.
 * Guarantees `id` and preserves hydrated identity and guardian fields.
 */
export const studentResponseRecordSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    contactId: z.union([z.string(), z.number()]).nullish(),
    studentId: z.string().optional(),
    grNumber: z.string().optional(),
    rollNumber: z.string().optional(),
    name: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    avatar: z.string().optional(),
    gender: z.string().optional(),
    isSyed: z.boolean().optional(),
    bloodGroup: z.string().optional(),
    dob: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    fatherContactId: z.union([z.string(), z.number()]).nullish(),
    fatherName: z.string().optional(),
    motherContactId: z.union([z.string(), z.number()]).nullish(),
    motherName: z.string().optional(),
    guardianContactId: z.union([z.string(), z.number()]).nullish(),
    guardianName: z.string().optional(),
    guardianRelationship: z.string().optional(),
    emergencyContact: z.string().optional(),
    emergencyPhone: z.string().optional(),
    gradeLevel: z.string().optional(),
    section: z.string().optional(),
    status: z.string().optional(),
    enrollmentDate: z.string().optional(),
    discountType: z.string().optional(),
    discountPct: z.number().optional(),
    notes: z.string().optional(),
    customFields: z.record(z.string(), z.unknown()).optional(),
    deletedAt: z.string().nullable().optional(),
  })
  .catchall(z.unknown());

export type StudentResponseRecord = z.infer<typeof studentResponseRecordSchema>;

/** Envelope for paginated student list responses (`StudentsListPageResult`). */
export const studentListPageResponseSchema = z.object({
  students: z.array(studentResponseRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});

/** `{ student }` envelope returned by get/create/update. */
export const studentWrappedResponseSchema = z.object({ student: studentResponseRecordSchema });

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
export const studentBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

/** Normalized Students Setup GR / auto-id preferences (`StudentModulePreferences`). */
export const studentPreferencesResponseSchema = z.object({
  autoGenerateId: z.boolean(),
  grNumberTemplate: z.string(),
  grNumberDigits: z.number(),
  grNumberRestartAnnually: z.boolean(),
});

/** Students Setup string-list lookups (`StudentLookupsMap`). */
export const studentLookupsResponseSchema = z.object({
  statuses: z.array(z.string()),
  genderFilters: z.array(z.string()),
  discountTypes: z.array(z.string()),
});

export const studentCrudRoutes = {
  list: {
    method: "GET" as const,
    path: "/api/students",
    query: studentsListQuerySchema,
    responses: {
      200: studentListPageResponseSchema,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "List students",
  },
  create: {
    method: "POST" as const,
    path: "/api/students",
    body: studentWireWriteSchema,
    responses: {
      200: z.object({ student: studentResponseRecordSchema }),
      201: z.object({ student: studentResponseRecordSchema }),
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Create a new student",
  },
  get: {
    method: "GET" as const,
    path: "/api/students/:id",
    query: includeDeletedQuerySchema.optional(),
    responses: {
      200: z.object({ student: studentResponseRecordSchema }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Get a single student",
  },
  update: {
    method: "PUT" as const,
    path: "/api/students/:id",
    body: studentWireWriteSchema,
    responses: {
      200: z.object({ student: studentResponseRecordSchema }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Update a student",
  },
  delete: {
    method: "DELETE" as const,
    path: "/api/students/:id",
    body: z.object({ deletionReason: z.string().optional() }).optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
      500: errorResponse,
    },
    summary: "Soft delete a student",
  },
} as const;

export const studentCrudContract = c.router(studentCrudRoutes);

export const studentOperationRoutes = {
  bulkStatus: {
    method: "POST" as const,
    path: "/api/students/bulk-status",
    body: studentsBulkStatusSchema,
    responses: {
      200: studentBulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk update student status",
  },
  bulkEnroll: {
    method: "POST" as const,
    path: "/api/students/bulk-enroll",
    body: studentsBulkEnrollBodySchema,
    responses: {
      200: studentBulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      422: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk enroll students",
  },
  nextGrNumber: {
    method: "GET" as const,
    path: "/api/students/next-gr-number",
    query: studentsNextGrNumberQuerySchema,
    responses: {
      200: z.object({ grNumber: z.string() }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get next available GR number",
  },
  duplicateCheck: {
    method: "POST" as const,
    path: "/api/students/duplicate-check",
    body: studentsDuplicateCheckBodySchema,
    responses: {
      200: z.object({
        reason: z.enum(["contact", "email", "nameDob", "grNumber"]).nullable(),
      }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Check for duplicate students",
  },
  migrateGrNumbers: {
    method: "POST" as const,
    path: "/api/students/migrate-gr-numbers",
    body: z.unknown(),
    responses: {
      200: z.object({
        success: z.literal(true),
        updated: z.number(),
        hasMore: z.boolean().optional(),
      }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Migrate GR numbers",
  },
} as const;

export const studentOperationsContract = c.router(studentOperationRoutes);
