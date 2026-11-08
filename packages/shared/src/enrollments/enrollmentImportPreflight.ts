import { z } from "zod";
import { enrollmentImportRowSchema } from "../schemas/moduleImport.dto.js";

/** Read-only validation of an enrollment import before it is queued. */
export const enrollmentImportPreflightBodySchema = z
  .object({
    rows: z.array(enrollmentImportRowSchema).min(1).max(500),
  })
  .strict();

export const enrollmentImportPreflightIssueSchema = z.object({
  row: z.number().int().min(1),
  reason: z.string().max(500),
});

export const enrollmentImportPreflightResultSchema = z.object({
  total: z.number().int(),
  valid: z.number().int(),
  invalid: z.number().int(),
  duplicates: z.number().int(),
  errors: z.array(enrollmentImportPreflightIssueSchema),
  preview: z.array(
    z.object({
      row: z.number().int(),
      studentId: z.string(),
      sessionId: z.string(),
      classId: z.string(),
      status: z.string(),
    }),
  ),
});

export type EnrollmentImportPreflightBody = z.infer<typeof enrollmentImportPreflightBodySchema>;
export type EnrollmentImportPreflightResult = z.infer<typeof enrollmentImportPreflightResultSchema>;
