import { z } from "zod";
import { facultyRecordSchema } from "../facultyModuleManifest.js";

export const facultyWidgetAggregateResultSchema = z.object({
  value: z.number(),
  totalCount: z.number(),
  chartData: z.array(z.object({ name: z.string(), value: z.number() })),
});

/** Envelope for paginated faculty list responses (`FacultyListPageResult`). */
export const facultyListPageResponseSchema = z.object({
  faculty: z.array(facultyRecordSchema).optional(),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

/** `{ success: true, faculty }` envelope returned by create/update. */
export const facultyWrappedResponseSchema = z.object({
  success: z.literal(true),
  faculty: facultyRecordSchema.optional(),
  facultyMember: facultyRecordSchema.optional(),
});

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
export const facultyBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

/** Normalized Faculty Setup employee-ID / contact-link prefs (`FacultyModulePreferences`). */
export const facultyPreferencesResponseSchema = z.object({
  idPrefix: z.string(),
  autoGenerateId: z.boolean(),
  requireContactLink: z.boolean(),
  defaultSpecialization: z.string(),
});
