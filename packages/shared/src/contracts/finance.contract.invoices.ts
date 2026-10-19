import { z } from "zod";
import {
  baseListQuerySchema,
  bulkIdsBodySchema,
  softDeleteBodySchema,
} from "../core/apiSchemas.js";
import { invoiceCreateSchema } from "../schemas/finance.dto.js";
import {
  invoiceRecordSchema,
  paymentRecordSchema,
  invoiceRecordUpdateSchema,
  invoicesBulkStatusSchema,
} from "../finance/financeModuleManifest.js";

const errorResponse = z.unknown();

/** Envelope for paginated invoice list responses. */
export const invoiceListPageResponseSchema = z.object({
  invoices: z.array(invoiceRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

/** Envelope for paginated payment list responses. */
export const paymentListPageResponseSchema = z.object({
  payments: z.array(paymentRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

/** `{ success: true, succeeded, failed }` bulk-operation envelope. */
export const financeBulkResultResponseSchema = z.object({
  success: z.literal(true),
  succeeded: z.number(),
  failed: z.number(),
});

/** Normalized Finance Setup preferences (`FinanceModulePreferences`). */
export const financePreferencesResponseSchema = z.object({
  currency: z.string(),
  invoicePrefix: z.string(),
  dueDays: z.string(),
  lateFeePercent: z.string(),
  taxRate: z.string(),
  paymentMethods: z.array(z.string()),
  autoGenerateInvoice: z.boolean(),
  sendInvoiceEmail: z.boolean(),
  allowPartialPayment: z.boolean(),
  requireApproval: z.boolean(),
  overdueReminder: z.boolean(),
  reminderDaysBefore: z.string(),
  feeReminders: z.boolean(),
  defaultViewLayout: z.string(),
});

/** `{ results }`-style widget aggregate values (`WidgetAggregateResult`). */
export const financeWidgetAggregateResultSchema = z.object({
  value: z.number(),
  totalCount: z.number(),
  chartData: z.array(z.object({ name: z.string(), value: z.number() })),
});

export const financeInvoiceRoutes = {
  getInvoice: {
    method: "GET" as const,
    path: "/api/finance/invoices/:id",
    query: z.object({ includeDeleted: z.string().optional() }).optional(),
    responses: {
      200: z.object({ invoice: invoiceRecordSchema }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Get a single invoice",
  },
  listInvoices: {
    method: "GET" as const,
    path: "/api/finance/invoices",
    query: baseListQuerySchema,
    responses: { 200: invoiceListPageResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "List invoices",
  },
  createInvoice: {
    method: "POST" as const,
    path: "/api/finance/invoices",
    body: invoiceCreateSchema,
    responses: {
      200: z.object({ invoice: invoiceRecordSchema }),
      201: z.object({ invoice: invoiceRecordSchema }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Create a new invoice",
  },
  updateInvoice: {
    method: "PUT" as const,
    path: "/api/finance/invoices/:id",
    body: invoiceRecordUpdateSchema,
    responses: {
      200: z.object({ invoice: invoiceRecordSchema }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Update an invoice",
  },
  deleteInvoice: {
    method: "DELETE" as const,
    path: "/api/finance/invoices/:id",
    body: softDeleteBodySchema.optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Delete an invoice",
  },
  bulkDeleteInvoices: {
    method: "POST" as const,
    path: "/api/finance/invoices/bulk-delete",
    body: bulkIdsBodySchema,
    responses: {
      200: financeBulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk soft-delete invoices",
  },
  bulkRestoreInvoices: {
    method: "POST" as const,
    path: "/api/finance/invoices/bulk-restore",
    body: bulkIdsBodySchema,
    responses: {
      200: financeBulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk restore invoices",
  },
  bulkStatusInvoices: {
    method: "POST" as const,
    path: "/api/finance/invoices/bulk-status",
    body: invoicesBulkStatusSchema,
    responses: {
      200: financeBulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk update invoice status",
  },
  restoreInvoice: {
    method: "POST" as const,
    path: "/api/finance/invoices/:id/restore",
    body: z.object({}),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a soft-deleted invoice",
  },
};
