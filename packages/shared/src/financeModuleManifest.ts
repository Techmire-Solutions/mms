import type { Permission } from "./permissions.js";
import { z } from "zod";
import {
  invoiceLineInsertSchema,
  invoiceLineRecordSchema,
  paymentAllocationInsertSchema,
  paymentAllocationRecordSchema,
} from "./financeBilling.js";
import { isoDateSchema } from "./isoDateSchema.js";

export const INVOICE_STATUSES = ["paid", "pending", "overdue", "partial", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const invoiceRecordSchema = z
  .object({
    id: z.string(),
    studentId: z.string(),
    studentName: z.string().default(""),
    class: z.string().default(""),
    session: z.string().default(""),
    baseFee: z.number().nonnegative().default(0),
    discountType: z.string().nullable().optional(),
    discountValue: z.number().nonnegative().default(0),
    discountAmt: z.number().nonnegative().default(0),
    finalAmt: z.number().nonnegative().default(0),
    status: z.enum(INVOICE_STATUSES).default("pending"),
    dueDate: z.string(),
    paidDate: z.string().nullable().optional(),
    method: z.string().nullable().optional(),
    paidAmt: z.number().nonnegative().optional(),
    invoiceNumber: z.string().optional(),
    feeStructureId: z.string().nullable().optional(),
    billingPeriod: z.string().nullable().optional(),
    enrollmentId: z.string().nullable().optional(),
    familyContactId: z.string().nullable().optional(),
    lateFeeAmt: z.number().nonnegative().optional(),
    creditedAmt: z.number().nonnegative().optional(),
    lastRemindedAt: z.string().nullable().optional(),
    reminderCount: z.number().int().nonnegative().optional(),
    lines: z.array(invoiceLineRecordSchema).optional(),
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
    restoredAt: z.string().nullable().optional(),
    restoredBy: z.string().nullable().optional(),
    deletedWithCascade: z.boolean().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const invoiceRecordInsertSchema = z
  .object({
    id: z.string().optional(),
    studentId: z.string().min(1, "Student ID is required"),
    studentName: z.string().optional().default(""),
    class: z.string().optional().default(""),
    session: z.string().optional().default(""),
    baseFee: z.number().nonnegative().default(0),
    discountType: z.string().nullable().optional(),
    discountValue: z.number().nonnegative().optional().default(0),
    discountAmt: z.number().nonnegative().optional().default(0),
    finalAmt: z.number().nonnegative().default(0),
    status: z.enum(INVOICE_STATUSES).optional().default("pending"),
    dueDate: isoDateSchema,
    paidDate: z.string().nullable().optional(),
    method: z.string().nullable().optional(),
    paidAmt: z.number().nonnegative().optional(),
    invoiceNumber: z.string().optional(),
    feeStructureId: z.string().nullable().optional(),
    billingPeriod: z.string().nullable().optional(),
    enrollmentId: z.string().nullable().optional(),
    familyContactId: z.string().nullable().optional(),
    lateFeeAmt: z.number().nonnegative().optional(),
    creditedAmt: z.number().nonnegative().optional(),
    lastRemindedAt: z.string().nullable().optional(),
    reminderCount: z.number().int().nonnegative().optional(),
    lines: z.array(invoiceLineInsertSchema).optional(),
  })
  .strict();

export const invoiceRecordUpdateSchema = invoiceRecordInsertSchema.partial().strict();

export type Invoice = z.infer<typeof invoiceRecordSchema>;
export type InvoiceInsert = z.infer<typeof invoiceRecordInsertSchema>;
export type InvoiceUpdate = z.infer<typeof invoiceRecordUpdateSchema>;
export type InvoiceCreateInput = InvoiceInsert;
export const invoiceListSchema = z.array(invoiceRecordSchema);

export function isInvoiceDeleted(invoice: { deletedAt?: string | null }): boolean {
  return Boolean(invoice.deletedAt);
}

export function filterActiveInvoices<T extends { deletedAt?: string | null }>(invoices: T[]): T[] {
  return invoices.filter((i) => !isInvoiceDeleted(i));
}

/**
 * Bulk status edits are limited to the open, ledger-neutral statuses.
 *
 * `paid` and `cancelled` are deliberately excluded: both change what the ledger
 * should say (a payment posting, or an invoice reversal) and neither can be
 * expressed by a bare status write. `paid` must go through payment recording and
 * `cancelled` through the cancel-invoice action, which posts the reversal —
 * allowing them here left invoices reading settled or cancelled while their
 * Dr AR / Cr Income entry stayed on the books forever.
 */
export const invoicesBulkStatusSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1, "At least one invoice ID is required"),
    status: z.enum(["pending", "overdue", "partial"]),
  })
  .strict();

export type InvoicesBulkStatusBody = z.infer<typeof invoicesBulkStatusSchema>;

/** Invoice statuses that still carry an unpaid balance (shared finance/dashboard SSOT). */
export const OPEN_INVOICE_STATUSES = ["pending", "overdue", "partial"] as const;
export type OpenInvoiceStatus = (typeof OPEN_INVOICE_STATUSES)[number];

const OPEN_INVOICE_STATUS_SET = new Set<string>(OPEN_INVOICE_STATUSES);

export function isOpenInvoiceStatus(status: string | undefined | null): boolean {
  return status != null && OPEN_INVOICE_STATUS_SET.has(status);
}

export const paymentRecordSchema = z
  .object({
    id: z.string(),
    invoiceId: z.string(),
    studentId: z.string().nullable().optional(),
    studentName: z.string().nullable().optional(),
    amount: z.number().positive(),
    date: z.string(),
    method: z.string().default("cash"),
    receivedByUserId: z.string().nullable().optional(),
    receivedBy: z.string().nullable().optional(),
    note: z.string().default(""),
    allocations: z.array(paymentAllocationRecordSchema).optional(),
    deletedAt: z.string().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
    deletionReason: z.string().nullable().optional(),
    restoredAt: z.string().nullable().optional(),
    restoredBy: z.string().nullable().optional(),
    deletedWithCascade: z.boolean().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const paymentRecordInsertSchema = z
  .object({
    id: z.string().optional(),
    invoiceId: z.string().min(1, "Invoice ID is required"),
    studentId: z.string().nullable().optional(),
    studentName: z.string().nullable().optional(),
    amount: z.number().positive("Amount must be greater than 0"),
    date: isoDateSchema,
    method: z.string().optional().default("cash"),
    receivedByUserId: z.string().nullable().optional(),
    receivedBy: z.string().nullable().optional(),
    note: z.string().optional().default(""),
    allocations: z.array(paymentAllocationInsertSchema).optional(),
  })
  .strict();

export const paymentRecordUpdateSchema = paymentRecordInsertSchema.partial().strict();

export type Payment = z.infer<typeof paymentRecordSchema>;
export type PaymentInsert = z.infer<typeof paymentRecordInsertSchema>;
export type PaymentUpdate = z.infer<typeof paymentRecordUpdateSchema>;
export type PaymentCreateInput = PaymentInsert;
export const paymentListSchema = z.array(paymentRecordSchema);

export function isPaymentDeleted(payment: { deletedAt?: string | null }): boolean {
  return Boolean(payment.deletedAt);
}

export function filterActivePayments<T extends { deletedAt?: string | null }>(payments: T[]): T[] {
  return payments.filter((p) => !isPaymentDeleted(p));
}

/** Finance module manifest — aligns with globle1 universal module architecture. */
export const FINANCE_MODULE_MANIFEST = {
  moduleId: "finance",
  entityType: "Invoice",
  collectionKey: "finance_invoices",
  paymentCollectionKey: "finance_payments",
  settingsObjectKey: "finance_settings",
  invoiceColumnPreferencesObjectKey: "finance_invoice_user_column_preferences",
  paymentColumnPreferencesObjectKey: "finance_payment_user_column_preferences",
  restBasePath: "/api/finance",
  analyticsCategory: "financial",
  tiers: ["work", "reports", "setup"] as const,
  setupSubTabs: ["preferences", "templates"] as const,
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    exportsIncludeDeleted: false,
    captureDeletionReason: false,
    retentionDays: null,
  },
  permissions: {
    read: "finance.write",
    write: "finance.write",
    delete: "finance.write",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    export: "finance.write",
    reports: "finance.write",
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ["invoices", "payments"] as const,
    bulkActions: ["delete", "status", "receipts", "export"] as const,
  },
  defaultPageSize: 10,
  maxPageSize: 100,
} as const;

export type FinanceModuleTier = (typeof FINANCE_MODULE_MANIFEST.tiers)[number];

/**
 * Calculates the collected amount for a single invoice.
 * Handles "paid" (returns finalAmt) and "partial" (returns paidAmt or 50% default fallback).
 *
 * @param invoice - The invoice record.
 * @returns The collected amount.
 */
export function getCollectedAmountForInvoice(invoice: Invoice): number {
  if (invoice.status === "paid") {
    return invoice.finalAmt;
  }
  if (invoice.status === "partial") {
    return invoice.paidAmt !== undefined && invoice.paidAmt !== null ? invoice.paidAmt : 0;
  }
  return 0;
}

/**
 * Calculates the outstanding amount for a single invoice.
 * Handles unpaid/uncollected balances for pending, partial, or overdue invoices.
 *
 * @param invoice - The invoice record.
 * @returns The outstanding amount.
 */
export function getOutstandingAmountForInvoice(invoice: Invoice): number {
  if (invoice.status === "cancelled" || invoice.status === "paid") {
    return 0;
  }
  const paid = invoice.paidAmt ?? 0;
  const late = invoice.lateFeeAmt ?? 0;
  const credited = invoice.creditedAmt ?? 0;
  return Math.max(0, invoice.finalAmt + late - credited - paid);
}

/**
 * Calculates the total collected amount from invoices for a specific month and year.
 *
 * @param invoices - The list of invoices to aggregate.
 * @param year - The year (e.g. 2026).
 * @param month - The month index (0-11, e.g. 0 for January).
 * @returns The total collected amount.
 */
export function getCollectedAmountForMonth(
  invoices: Invoice[],
  year: number,
  month: number,
): number {
  let sum = 0;
  invoices.forEach((inv) => {
    if (!inv || inv.status === "cancelled") return;
    const dateStr = inv.paidDate || inv.dueDate || "";
    if (!dateStr) return;
    const invYear = Number(dateStr.slice(0, 4));
    const invMonth = Number(dateStr.slice(5, 7)) - 1;
    if (invYear === year && invMonth === month) {
      sum += getCollectedAmountForInvoice(inv);
    }
  });
  return sum;
}

/**
 * Calculates the total outstanding amount from invoices for a specific month and year.
 *
 * @param invoices - The list of invoices to aggregate.
 * @param year - The year (e.g. 2026).
 * @param month - The month index (0-11, e.g. 0 for January).
 * @returns The total outstanding amount.
 */
export function getOutstandingAmountForMonth(
  invoices: Invoice[],
  year: number,
  month: number,
): number {
  let sum = 0;
  invoices.forEach((inv) => {
    if (!inv || inv.status === "cancelled" || inv.status === "paid") return;
    const dateStr = inv.dueDate || "";
    if (!dateStr) return;
    const invYear = Number(dateStr.slice(0, 4));
    const invMonth = Number(dateStr.slice(5, 7)) - 1;
    if (invYear === year && invMonth === month) {
      sum += getOutstandingAmountForInvoice(inv);
    }
  });
  return sum;
}
