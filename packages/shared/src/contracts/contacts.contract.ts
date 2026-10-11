import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { contactRecordSchema } from "../contactsModuleManifest.js";
import { contactIdentityMatchResultSchema } from "../contactIdentityMatch.js";
import { baseListQuerySchema } from "../apiSchemas.js";
import { contactWireWriteSchema } from "../schemas/contacts.dto.js";

const c = initContract();

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

const contactBulkRestoreConflictSchema = z.object({
  id: z.string(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })),
});

export const contactsContract = c.router({
  list: {
    method: "GET",
    path: "/api/contacts",
    query: baseListQuerySchema,
    responses: {
      200: contactListPageResponseSchema,
    },
    summary: "List contacts",
  },
  create: {
    method: "POST",
    path: "/api/contacts",
    body: contactWireWriteSchema,
    responses: {
      200: contactWrappedResponseSchema,
      201: contactWrappedResponseSchema,
    },
    summary: "Create a new contact",
  },
  get: {
    method: "GET",
    path: "/api/contacts/:id",
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: z.object({ contact: contactRecordSchema }),
      404: z.unknown(),
    },
    summary: "Get a contact by ID",
  },
  update: {
    method: "PUT",
    path: "/api/contacts/:id",
    pathParams: z.object({ id: z.string() }),
    body: contactWireWriteSchema,
    responses: {
      200: contactWrappedResponseSchema,
      400: z.unknown(),
      404: z.unknown(),
    },
    summary: "Update a contact",
  },
  delete: {
    method: "DELETE",
    path: "/api/contacts/:id",
    pathParams: z.object({ id: z.string() }),
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      404: z.unknown(),
    },
    summary: "Delete a contact",
  },
  reportAnalytics: {
    method: "GET",
    path: "/api/contacts/report-analytics",
    query: contactsReportAnalyticsQuerySchema,
    responses: {
      200: z.object({
        analytics: z.object({
          total: z.number(),
          activeCount: z.number(),
          whatsappCount: z.number(),
          whatsappRate: z.number(),
          missingInfoCount: z.number(),
          newLast30Days: z.number(),
          newPrior30Days: z.number(),
          newThisPeriod: z.number(),
          hasSignupDates: z.boolean(),
          growthRecentSignups30d: z.number(),
          growthPriorSignups30d: z.number(),
        }),
        monthlyByYear: z
          .array(
            z.object({
              year: z.number(),
              months: z.array(z.object({ month: z.string(), count: z.number() })),
            }),
          )
          .optional(),
      }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get contact report analytics",
  },
  restore: {
    method: "POST",
    path: "/api/contacts/:id/restore",
    body: z.unknown(),
    responses: { 200: contactWrappedResponseSchema, 404: z.unknown(), 500: z.unknown() },
    summary: "Restore a contact",
  },
  bulkDelete: {
    method: "POST",
    path: "/api/contacts/bulk-delete",
    body: z.object({ ids: z.array(z.string()), deletionReason: z.string().optional() }),
    responses: { 200: contactBulkResultResponseSchema, 500: z.unknown() },
    summary: "Bulk delete contacts",
  },
  bulkRestore: {
    method: "POST",
    path: "/api/contacts/bulk-restore",
    body: z.object({ ids: z.array(z.string()) }),
    responses: {
      200: z.object({
        success: z.literal(true),
        succeeded: z.number(),
        failed: z.number(),
        conflicts: z.array(contactBulkRestoreConflictSchema),
      }),
      500: z.unknown(),
    },
    summary: "Bulk restore contacts",
  },
  exportAudit: {
    method: "POST",
    path: "/api/contacts/export-audit",
    body: z.object({ count: z.number(), scope: z.enum(["all", "filtered", "selection"]) }),
    responses: { 200: z.object({ success: z.literal(true) }), 500: z.unknown() },
    summary: "Log export audit",
  },
  setupAudit: {
    method: "POST",
    path: "/api/contacts/setup-audit",
    body: z.object({ area: z.enum(["fields", "preferences"]), summary: z.string() }),
    responses: { 200: z.object({ success: z.literal(true) }), 500: z.unknown() },
    summary: "Log setup audit",
  },
  resolve: {
    method: "POST",
    path: "/api/contacts/resolve",
    body: z.object({ ids: z.array(z.string()) }),
    responses: { 200: z.object({ contacts: z.array(contactRecordSchema) }), 500: z.unknown() },
    summary: "Resolve contacts by IDs",
  },
  merge: {
    method: "POST",
    path: "/api/contacts/merge",
    body: z.unknown(),
    responses: { 200: contactWrappedResponseSchema, 400: z.unknown(), 500: z.unknown() },
    summary: "Merge contacts",
  },
  identityMatch: {
    method: "POST",
    path: "/api/contacts/identity-match",
    body: z.unknown(),
    responses: { 200: contactIdentityMatchResultSchema, 400: z.unknown(), 500: z.unknown() },
    summary: "Match contact identity",
  },
  bulkTag: {
    method: "POST",
    path: "/api/contacts/bulk-tag",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true), updatedCount: z.number() }),
      500: z.unknown(),
    },
    summary: "Bulk tag contacts",
  },
  widgetAggregates: {
    method: "POST",
    path: "/api/contacts/widget-aggregates",
    body: z.object({ widgets: z.array(z.unknown()) }),
    responses: {
      200: z.object({ results: z.record(z.string(), contactWidgetAggregateResultResponseSchema) }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get widget aggregates",
  },
  getFieldConfig: {
    method: "GET",
    path: "/api/contacts/field-config",
    responses: {
      200: z.object({ config: z.record(z.string(), z.unknown()).nullable() }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get contact field config",
  },
  updateFieldConfig: {
    method: "PUT",
    path: "/api/contacts/field-config",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true), config: z.record(z.string(), z.unknown()) }),
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Update contact field config",
  },
  getPreferences: {
    method: "GET",
    path: "/api/contacts/preferences",
    responses: {
      200: z.object({ preferences: z.record(z.string(), z.unknown()) }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get contact preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/contacts/preferences",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true), preferences: z.record(z.string(), z.unknown()) }),
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Update contact preferences",
  },
  getDuplicates: {
    method: "GET",
    path: "/api/contacts/duplicates",
    query: baseListQuerySchema,
    responses: {
      200: z.object({
        pairs: z.array(
          z.object({
            id: z.string(),
            confidence: z.number(),
            reasonKey: z.string(),
            contacts: z.array(contactRecordSchema),
          }),
        ),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        hasMore: z.boolean(),
      }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get contact duplicates",
  },
  getColumnPreferences: {
    method: "GET",
    path: "/api/contacts/column-preferences",
    responses: { 200: z.unknown(), 403: z.unknown(), 500: z.unknown() },
    summary: "Get contact column preferences",
  },
  updateColumnPreferences: {
    method: "PUT",
    path: "/api/contacts/column-preferences",
    body: z.object({ preferences: z.array(z.unknown()) }),
    responses: { 200: z.unknown(), 403: z.unknown(), 500: z.unknown() },
    summary: "Update contact column preferences",
  },
  getSavedReports: {
    method: "GET",
    path: "/api/contacts/saved-reports",
    responses: {
      200: z.object({ reports: z.array(contactSavedReportSchema) }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get contact saved reports",
  },
  createSavedReport: {
    method: "POST",
    path: "/api/contacts/saved-reports",
    body: z.unknown(),
    responses: {
      200: z.object({ report: contactSavedReportSchema }),
      400: z.unknown(),
      500: z.unknown(),
    },
    summary: "Create contact saved report",
  },
  deleteSavedReport: {
    method: "DELETE",
    path: "/api/contacts/saved-reports/:id",
    pathParams: z.object({ id: z.string() }),
    body: z.unknown(),
    responses: { 200: z.object({ success: z.literal(true) }), 404: z.unknown(), 500: z.unknown() },
    summary: "Delete contact saved report",
  },
  runSavedReport: {
    method: "POST",
    path: "/api/contacts/saved-reports/:id/run",
    pathParams: z.object({ id: z.string() }),
    body: z.unknown(),
    responses: {
      200: z.object({ report: contactSavedReportSchema }),
      404: z.unknown(),
      500: z.unknown(),
    },
    summary: "Run contact saved report",
  },
  getLookups: {
    method: "GET",
    path: "/api/contacts/lookups",
    responses: {
      200: z.object({ lookups: contactLookupsMapResponseSchema }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get contact lookups",
  },
  updateLookups: {
    method: "PUT",
    path: "/api/contacts/lookups/:kind",
    pathParams: z.object({ kind: z.string() }),
    body: z.unknown(),
    responses: {
      200: z.object({
        success: z.literal(true),
        kind: z.string(),
        items: z.array(z.union([z.string(), z.object({ country: z.string(), code: z.string() })])),
        mirroredFromPrefs: z.boolean().optional(),
      }),
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Update contact lookups",
  },
  duplicateCheck: {
    method: "POST",
    path: "/api/contacts/duplicate-check",
    body: z.object({ contact: z.unknown() }),
    responses: { 200: z.object({ matchCount: z.number() }), 500: z.unknown() },
    summary: "Check for duplicate contacts",
  },
  getGoogleSyncConfig: {
    method: "GET",
    path: "/api/contacts/google-sync",
    responses: {
      200: z.object({ config: googleSyncClientConfigResponseSchema }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Get Google Sync config",
  },
  updateGoogleSyncConfig: {
    method: "PUT",
    path: "/api/contacts/google-sync",
    body: z.unknown(),
    responses: {
      200: z.object({ config: googleSyncClientConfigResponseSchema }),
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Update Google Sync config",
  },
  logGoogleSyncAudit: {
    method: "POST",
    path: "/api/contacts/google-sync/audit",
    body: z.unknown(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Log Google Sync audit",
  },
  exchangeGoogleSyncOAuth: {
    method: "POST",
    path: "/api/contacts/google-sync/exchange",
    body: z.unknown(),
    responses: {
      200: z.object({ config: googleSyncClientConfigResponseSchema }),
      400: z.unknown(),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Exchange Google Sync OAuth code",
  },
  runGoogleSync: {
    method: "POST",
    path: "/api/contacts/google-sync/run",
    body: z.unknown(),
    responses: {
      200: z.object({
        total: z.number(),
        imported: z.number(),
        updated: z.number().optional(),
        skipped: z.number(),
        skippedName: z.number(),
        skippedUnique: z.number(),
      }),
      403: z.unknown(),
      500: z.unknown(),
    },
    summary: "Run Google Sync",
  },
  getFieldUsage: {
    method: "GET",
    path: "/api/contacts/field-usage/:fieldId",
    pathParams: z.object({ fieldId: z.string() }),
    responses: { 200: z.unknown(), 500: z.unknown() },
    summary: "Get single field usage count",
  },
  getFieldsUsage: {
    method: "POST",
    path: "/api/contacts/field-usage",
    body: z.object({ fieldKeys: z.array(z.string()) }),
    responses: { 200: z.unknown(), 500: z.unknown() },
    summary: "Get multiple fields usage counts",
  },
});
