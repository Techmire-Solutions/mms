import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { baseListQuerySchema } from "../core/apiSchemas.js";
import { journalTemplatesSchema } from "../finance/accountingJournalTemplates.js";
import {
  accountingAccountsListQuerySchema,
  accountingEntriesListQuerySchema,
} from "../finance/accountingListQuery.js";
import {
  accountRecordSchema,
  journalEntryRecordSchema,
  fiscalYearRecordSchema,
} from "../finance/accountingModuleManifest.js";
import {
  accountingReportAggregatesSchema,
  accountingReportQuerySchema,
} from "../finance/accountingReportAggregates.js";
import {
  accountingFieldConfigPutBodySchema,
  accountingPreferencesPutBodySchema,
} from "../finance/accountingSetupConfigTypes.js";

const c = initContract();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const ok = z.unknown();

const paginationFields = {
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
};

/** Envelope for paginated chart-of-accounts responses. */
export const accountingAccountsPageResponseSchema = z.object({
  accounts: z.array(accountRecordSchema),
  ...paginationFields,
});

/** Envelope for paginated journal-entry responses. */
export const accountingEntriesPageResponseSchema = z.object({
  entries: z.array(journalEntryRecordSchema),
  ...paginationFields,
});

/** Envelope for paginated fiscal-year responses. */
export const accountingFiscalYearsPageResponseSchema = z.object({
  fiscalYears: z.array(fiscalYearRecordSchema),
  ...paginationFields,
});

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
const accountingBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

/** Normalized Accounting Setup preferences (`AccountingModulePreferences`). */
export const accountingPreferencesResponseSchema = z.object({
  currency: z.string(),
  currencySymbol: z.string(),
  dateFormat: z.string(),
  decimalSeparator: z.enum(["period", "comma"]),
  decimalPlaces: z.number(),
  fyStartMonth: z.string(),
  accountCodeLength: z.number(),
  requireNarration: z.boolean(),
  allowEditPosted: z.boolean(),
  autoPostDrafts: z.boolean(),
  retainedEarningsAccount: z.string(),
  organizationName: z.string().optional(),
  defaultViewLayout: z.string().optional(),
  journalTemplates: journalTemplatesSchema.optional(),
});

/**
 * These three operations are served by the shared CRUD bulk route
 * (`registerIncludableBulkRoutes` → `PUT {path}/bulk`), whose handler is
 * **additive upsert**, not a destructive replace: rows missing from the payload
 * are left untouched, and removals must go through the explicit
 * delete/bulk-delete operations. They were previously named `replace*`, which
 * contradicted the handler they actually resolve to.
 */
export const accountingContract = c.router({
  listAccounts: {
    method: "GET",
    path: "/api/accounting/accounts",
    query: accountingAccountsListQuerySchema,
    responses: {
      200: z.union([
        z.object({ accounts: z.array(accountRecordSchema) }),
        accountingAccountsPageResponseSchema,
      ]),
      403: ok,
      500: ok,
    },
    summary: "List chart-of-accounts entries",
  },
  listEntries: {
    method: "GET",
    path: "/api/accounting/entries",
    query: accountingEntriesListQuerySchema,
    responses: {
      200: z.union([
        z.object({ entries: z.array(journalEntryRecordSchema) }),
        accountingEntriesPageResponseSchema,
      ]),
      403: ok,
      500: ok,
    },
    summary: "List journal entries",
  },
  listFiscalYears: {
    method: "GET",
    path: "/api/accounting/fiscal-years",
    query: baseListQuerySchema,
    responses: {
      200: z.union([
        z.object({ fiscalYears: z.array(fiscalYearRecordSchema) }),
        accountingFiscalYearsPageResponseSchema,
      ]),
      403: ok,
      500: ok,
    },
    summary: "List fiscal years",
  },
  upsertAccounts: {
    method: "PUT",
    path: "/api/accounting/accounts/bulk",
    body: ok,
    responses: { 200: z.object({ accounts: z.array(accountRecordSchema) }), 403: ok, 500: ok },
    summary: "Bulk upsert accounts (additive; removals use the delete routes)",
  },
  upsertEntries: {
    method: "PUT",
    path: "/api/accounting/entries/bulk",
    body: ok,
    responses: { 200: z.object({ entries: z.array(journalEntryRecordSchema) }), 403: ok, 500: ok },
    summary: "Bulk upsert journal entries (additive; posted entries are immutable)",
  },
  upsertFiscalYears: {
    method: "PUT",
    path: "/api/accounting/fiscal-years/bulk",
    body: ok,
    responses: {
      200: z.object({ fiscalYears: z.array(fiscalYearRecordSchema) }),
      403: ok,
      500: ok,
    },
    summary: "Bulk upsert fiscal years (additive; closed periods are locked)",
  },
  deleteEntry: {
    method: "DELETE",
    path: "/api/accounting/entries/:id",
    body: ok,
    responses: { 200: z.object({ success: z.literal(true) }), 403: ok, 500: ok },
    summary: "Delete entry",
  },
  restoreEntry: {
    method: "POST",
    path: "/api/accounting/entries/:id/restore",
    body: ok,
    responses: { 200: z.object({ success: z.literal(true) }), 403: ok, 500: ok },
    summary: "Restore entry",
  },
  bulkDeleteEntries: {
    method: "POST",
    path: "/api/accounting/entries/bulk-delete",
    body: z.object({ ids: z.array(z.string()) }),
    responses: { 200: accountingBulkResultResponseSchema, 403: ok, 500: ok },
    summary: "Bulk delete entries",
  },
  bulkRestoreEntries: {
    method: "POST",
    path: "/api/accounting/entries/bulk-restore",
    body: z.object({ ids: z.array(z.string()) }),
    responses: { 200: accountingBulkResultResponseSchema, 403: ok, 500: ok },
    summary: "Bulk restore entries",
  },

  getFieldConfig: {
    method: "GET",
    path: "/api/accounting/field-config",
    responses: {
      200: z.object({ config: z.record(z.string(), z.unknown()).nullable() }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get field config",
  },
  updateFieldConfig: {
    method: "PUT",
    path: "/api/accounting/field-config",
    body: accountingFieldConfigPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), config: z.record(z.string(), z.unknown()) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update field config",
  },
  getPreferences: {
    method: "GET",
    path: "/api/accounting/preferences",
    responses: {
      200: z.object({ preferences: accountingPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/accounting/preferences",
    body: accountingPreferencesPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), preferences: accountingPreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update preferences",
  },
  getReportAggregates: {
    method: "GET",
    path: "/api/accounting/report-aggregates",
    query: accountingReportQuerySchema.optional(),
    responses: { 200: accountingReportAggregatesSchema, 403: errorResponse, 500: errorResponse },
    summary: "Get accounting report aggregates",
  },
});
