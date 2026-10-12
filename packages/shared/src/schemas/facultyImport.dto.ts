import { z } from "zod";
import { FACULTY_CATALOG_STATUS_VALUES, FACULTY_STATUS_VALUES } from "../facultyTypes.js";
import { deepSanitizeStrings } from "./sanitize.js";
import { isoDateSchema } from "../isoDateSchema.js";

export const FACULTY_IMPORT_MAX_BATCH = 500;
const calendarDate = z.string().trim().pipe(isoDateSchema);

const importIdempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .optional();

const facultyImportRowSchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    employeeId: z.string().trim().max(100).optional(),
    contactId: z.string().trim().max(100).optional(),
    specialization: z.string().trim().max(200).optional(),
    department: z.string().trim().max(255).optional(),
    designation: z.string().trim().max(150).optional(),
    status: z.enum(FACULTY_STATUS_VALUES).optional(),
    qualification: z.string().trim().max(200).optional(),
    employmentStartDate: calendarDate.optional(),
    employmentEndDate: calendarDate.optional(),
    /** @deprecated Legacy alias of `employmentStartDate`. */
    joinDate: calendarDate.optional(),
    phone: z.string().trim().max(50).optional(),
    email: z.string().trim().max(255).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .passthrough();

export const facultyImportBodySchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    return deepSanitizeStrings(raw);
  },
  z
    .object({
      rows: z.array(facultyImportRowSchema).min(1).max(FACULTY_IMPORT_MAX_BATCH),
      label: z.string().min(1).max(200).optional(),
      idempotencyKey: importIdempotencyKeySchema,
    })
    .strict(),
);

export type FacultyImportBody = z.infer<typeof facultyImportBodySchema>;

export interface FacultyImportJobPayload {
  rows: FacultyImportBody["rows"];
  label?: string;
  viewerRole: string;
  language?: string;
}

const departmentImportRowSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().max(2000).optional(),
    status: z.enum(FACULTY_CATALOG_STATUS_VALUES).optional(),
  })
  .strict();

export const facultyDepartmentImportBodySchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    return deepSanitizeStrings(raw);
  },
  z
    .object({
      rows: z.array(departmentImportRowSchema).min(1).max(FACULTY_IMPORT_MAX_BATCH),
      label: z.string().min(1).max(200).optional(),
      idempotencyKey: importIdempotencyKeySchema,
    })
    .strict(),
);

export type FacultyDepartmentImportBody = z.infer<typeof facultyDepartmentImportBodySchema>;

const designationImportRowSchema = z
  .object({
    department: z.string().trim().min(1).max(255),
    name: z.string().trim().min(1).max(150),
    parentDesignation: z.string().trim().max(150).optional(),
    status: z.enum(FACULTY_CATALOG_STATUS_VALUES).optional(),
  })
  .strict();

export const facultyDesignationImportBodySchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    return deepSanitizeStrings(raw);
  },
  z
    .object({
      rows: z.array(designationImportRowSchema).min(1).max(FACULTY_IMPORT_MAX_BATCH),
      label: z.string().min(1).max(200).optional(),
      idempotencyKey: importIdempotencyKeySchema,
    })
    .strict(),
);

export type FacultyDesignationImportBody = z.infer<typeof facultyDesignationImportBodySchema>;
