import { z } from "zod";
import { contactRecordSchema } from "../contacts/contactsModuleManifest.js";

export const contactsReportAnalyticsQuerySchema = z.object({
  years: z
    .union([z.string(), z.array(z.number())])
    .optional()
    .transform((value) => {
      if (Array.isArray(value)) return value;
      return value
        ? value
            .split(",")
            .map((year) => Number.parseInt(year.trim(), 10))
            .filter((year) => Number.isFinite(year) && year >= 1900 && year <= 2100)
        : [];
    }),
  lang: z.string().max(16).optional(),
});

/** Envelope for paginated contact list responses (`ContactsListPageResult`). */
export const contactListPageResponseSchema = z.object({
  contacts: z.array(contactRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});

/** `{ success: true, contact }` envelope returned by create/update/merge/restore. */
export const contactWrappedResponseSchema = z.object({
  success: z.literal(true),
  contact: contactRecordSchema,
});

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
export const contactBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

/** Contacts Setup per-kind lookup map (`ContactLookupsMap`). */
export const contactLookupsMapResponseSchema = z.object({
  genders: z.array(z.string()),
  socialPlatforms: z.array(z.string()),
  relationships: z.array(z.string()),
  phoneLabels: z.array(z.string()),
  emailLabels: z.array(z.string()),
  addressLabels: z.array(z.string()),
  countryCodes: z.array(z.object({ country: z.string(), code: z.string() })),
  educationDegrees: z.array(z.string()),
  employmentTypes: z.array(z.string()),
  skillCategories: z.array(z.string()),
  skillProficiencies: z.array(z.string()),
  tags: z.array(z.string()),
});

/** Redacted Google Contacts sync config sent to the client. */
export const googleSyncClientConfigResponseSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  clearTokens: z.boolean().optional(),
  updatedAt: z.string().optional(),
  hasClientSecret: z.boolean().optional(),
  hasRefreshToken: z.boolean().optional(),
  isConnected: z.boolean().optional(),
});

export const contactWidgetAggregateResultResponseSchema = z.object({
  value: z.number(),
  totalCount: z.number(),
  chartData: z.array(z.object({ name: z.string(), value: z.number() })),
});

/** Contact saved report row (`ContactsSavedReport`). */
export const contactSavedReportSchema = z.object({
  id: z.string(),
  name: z.string(),
  drillDown: z
    .object({
      gender: z.string().optional(),
      search: z.string().optional(),
      quickFilter: z.string().optional(),
    })
    .passthrough(),
  createdBy: z.string(),
  createdByName: z.string().optional(),
  createdAt: z.string(),
  lastRunAt: z.string().optional(),
  shareScope: z.enum(["private", "roles", "users", "global"]).optional(),
  sharedWithRoles: z.array(z.string()).optional(),
  sharedWithUserIds: z.array(z.string()).optional(),
});

export const contactBulkRestoreConflictSchema = z.object({
  id: z.string(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })),
});
