import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { baseListQuerySchema, bulkIdsBodySchema, softDeleteBodySchema } from "../apiSchemas.js";
import { invoiceCreateSchema, paymentCreateSchema } from "../schemas/finance.dto.js";
import { widgetAggregatesBodySchema } from "../schemas/common.dto.js";
import {
  invoiceRecordSchema,
  paymentRecordSchema,
  invoiceRecordUpdateSchema,
  paymentRecordUpdateSchema,
  invoicesBulkStatusSchema,
} from "../financeModuleManifest.js";
import { financeReportAggregatesSchema } from "../financeReportAggregates.js";
import { reportComparisonQuerySchema } from "../reportComparisonQuery.js";
import {
  financeFieldConfigPutBodySchema,
  financePreferencesPutBodySchema,
} from "../financeSetupConfigTypes.js";

const c = initContract();

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
const financeBulkResultResponseSchema = z.object({
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
const financeWidgetAggregateResultSchema = z.object({
  value: z.number(),
  totalCount: z.number(),
  chartData: z.array(z.object({ name: z.string(), value: z.number() })),
});

export const financeContract = c.router({
  getInvoice: {
    method: "GET",
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
    method: "GET",
    path: "/api/finance/invoices",
    query: baseListQuerySchema,
    responses: { 200: invoiceListPageResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "List invoices",
  },
  createInvoice: {
    method: "POST",
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
    method: "PUT",
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
    method: "DELETE",
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
  getPayment: {
    method: "GET",
    path: "/api/finance/payments/:id",
    query: z.object({ includeDeleted: z.string().optional() }).optional(),
    responses: {
      200: z.object({ payment: paymentRecordSchema }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Get a single payment",
  },
  listPayments: {
    method: "GET",
    path: "/api/finance/payments",
    query: baseListQuerySchema,
    responses: { 200: paymentListPageResponseSchema, 403: errorResponse, 500: errorResponse },
    summary: "List payments",
  },
  createPayment: {
    method: "POST",
    path: "/api/finance/payments",
    body: paymentCreateSchema,
    responses: {
      200: z.object({ payment: paymentRecordSchema }),
      201: z.object({ payment: paymentRecordSchema }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Create a new payment",
  },
  updatePayment: {
    method: "PUT",
    path: "/api/finance/payments/:id",
    body: paymentRecordUpdateSchema,
    responses: {
      200: z.object({ payment: paymentRecordSchema }),
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Update a payment",
  },
  deletePayment: {
    method: "DELETE",
    path: "/api/finance/payments/:id",
    body: softDeleteBodySchema.optional(),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Delete a payment",
  },
  bulkDeleteInvoices: {
    method: "POST",
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
    method: "POST",
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
    method: "POST",
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
  bulkDeletePayments: {
    method: "POST",
    path: "/api/finance/payments/bulk-delete",
    body: bulkIdsBodySchema,
    responses: {
      200: financeBulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk soft-delete payments",
  },
  bulkRestorePayments: {
    method: "POST",
    path: "/api/finance/payments/bulk-restore",
    body: bulkIdsBodySchema,
    responses: {
      200: financeBulkResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Bulk restore payments",
  },
  restoreInvoice: {
    method: "POST",
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
  restorePayment: {
    method: "POST",
    path: "/api/finance/payments/:id/restore",
    body: z.object({}),
    responses: {
      200: z.object({ success: z.literal(true) }),
      403: errorResponse,
      404: errorResponse,
      500: errorResponse,
    },
    summary: "Restore a soft-deleted payment",
  },
  getMetrics: {
    method: "GET",
    path: "/api/finance/metrics",
    responses: {
      200: z.object({
        metrics: z.object({
          totalInvoices: z.number(),
          outstanding: z.number(),
          overdue: z.number(),
          paid: z.number(),
          partial: z.number(),
          totalPayments: z.number(),
          collectedTotal: z.number(),
          outstandingBalance: z.number(),
          discountTotal: z.number(),
          collectedThisMonth: z.number(),
          collectedPrevMonth: z.number(),
          outstandingThisMonth: z.number(),
          outstandingPrevMonth: z.number(),
        }),
      }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get finance command metrics",
  },
  widgetAggregates: {
    method: "POST",
    path: "/api/finance/widget-aggregates",
    body: widgetAggregatesBodySchema,
    responses: {
      200: z.record(z.string(), financeWidgetAggregateResultSchema),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get widget aggregates",
  },
  getFieldConfig: {
    method: "GET",
    path: "/api/finance/field-config",
    responses: {
      200: z.object({ config: z.record(z.string(), z.unknown()).nullable() }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get finance field config",
  },
  updateFieldConfig: {
    method: "PUT",
    path: "/api/finance/field-config",
    body: financeFieldConfigPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), config: z.record(z.string(), z.unknown()) }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update finance field config",
  },
  getPreferences: {
    method: "GET",
    path: "/api/finance/preferences",
    responses: {
      200: z.object({ preferences: financePreferencesResponseSchema }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Get finance preferences",
  },
  updatePreferences: {
    method: "PUT",
    path: "/api/finance/preferences",
    body: financePreferencesPutBodySchema,
    responses: {
      200: z.object({ success: z.literal(true), preferences: financePreferencesResponseSchema }),
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Update finance preferences",
  },
  getReportAggregates: {
    method: "GET",
    path: "/api/finance/report-aggregates",
    query: reportComparisonQuerySchema.optional(),
    responses: { 200: financeReportAggregatesSchema, 403: errorResponse, 500: errorResponse },
    summary: "Get finance report aggregates",
  },
});
