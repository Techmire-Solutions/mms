import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

const exportColumnSchema = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().min(1).max(200),
  })
  .strict();

const exportIdempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .optional();

/**
 * Shared CSV export enqueue body (Contacts/Students). Pass the module list-query schema.
 */
export function csvExportBodySchema<TQuery extends z.ZodType>(listQuerySchema: TQuery) {
  const base = z
    .object({
      query: listQuerySchema.optional(),
      /** Explicit id selection — prefer over page-local FE filtering. */
      ids: z
        .array(z.union([z.string(), z.number()]))
        .min(1)
        .max(500)
        .optional(),
      columns: z.array(exportColumnSchema).max(200).optional(),
      filename: z.string().min(1).max(200).optional(),
      label: z.string().min(1).max(500).optional(),
      /** Client retry key — reused as the background job id when provided. */
      idempotencyKey: exportIdempotencyKeySchema,
    })
    .strict();

  return z.preprocess((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    return deepSanitizeStrings(raw);
  }, base);
}

/** Shared Work CSV export audit body (Contacts/Students). */
const moduleExportAuditBodyBaseSchema = z
  .object({
    count: z.number().int().min(0).max(1_000_000),
    scope: z.enum(["all", "filtered", "selection"]).optional(),
  })
  .strict();

export const moduleExportAuditBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, moduleExportAuditBodyBaseSchema);

/** Shared Setup save audit body (Contacts includes `sync`; Students uses fields/preferences). */
const moduleSetupAuditBodyBaseSchema = z
  .object({
    area: z.enum(["fields", "preferences", "sync"]),
    summary: z.string().min(1).max(500),
  })
  .strict();

export const moduleSetupAuditBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, moduleSetupAuditBodyBaseSchema);

/** Setup audit areas for person modules — fields/preferences only (no Contacts sync tab). */
const moduleFieldsPrefsAuditBodyBaseSchema = z
  .object({
    area: z.enum(["fields", "preferences"]),
    summary: z.string().min(1).max(500),
  })
  .strict();

export const moduleFieldsPrefsAuditBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, moduleFieldsPrefsAuditBodyBaseSchema);

import { contactsListQuerySchema } from "../contacts/contactsListQuery.js";
import { studentsListQuerySchema } from "../students/studentsListQuery.js";
import { facultyListQuerySchema } from "../faculty/facultyListQuery.js";
import { sessionsListQuerySchema } from "../sessions/sessionsListQuery.js";
import { enrollmentsListQuerySchema } from "../enrollments/enrollmentsListQuery.js";
import { usersListQuerySchema } from "../auth/usersListQuery.js";

export const contactsCsvExportBodySchema = csvExportBodySchema(contactsListQuerySchema);
export const studentsCsvExportBodySchema = csvExportBodySchema(studentsListQuerySchema);
export const facultyCsvExportBodySchema = csvExportBodySchema(facultyListQuerySchema);
export const sessionsCsvExportBodySchema = csvExportBodySchema(sessionsListQuerySchema);
export const enrollmentsCsvExportBodySchema = csvExportBodySchema(enrollmentsListQuerySchema);
export const usersCsvExportBodySchema = csvExportBodySchema(usersListQuerySchema);

/** Catalog exports have no list-query filters — accept empty/partial body. */
const emptyListQuerySchema = z.object({}).passthrough();
export const facultyDepartmentsCsvExportBodySchema = csvExportBodySchema(emptyListQuerySchema);
export const facultyDesignationsCsvExportBodySchema = csvExportBodySchema(emptyListQuerySchema);
export const questionBankCsvExportBodySchema = csvExportBodySchema(emptyListQuerySchema);
export const accountingCsvExportBodySchema = csvExportBodySchema(emptyListQuerySchema);
export const financeCsvExportBodySchema = csvExportBodySchema(emptyListQuerySchema);
export const attendanceCsvExportBodySchema = csvExportBodySchema(emptyListQuerySchema);
export const examinationsCsvExportBodySchema = csvExportBodySchema(emptyListQuerySchema);
export const hasanatCsvExportBodySchema = csvExportBodySchema(emptyListQuerySchema);
export const obligationsCsvExportBodySchema = csvExportBodySchema(emptyListQuerySchema);
export const tasksCsvExportBodySchema = csvExportBodySchema(emptyListQuerySchema);
