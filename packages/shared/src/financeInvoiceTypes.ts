/** Finance invoice statuses, record schemas, and bulk-status DTOs. */
import { z } from "zod";
import { invoiceLineInsertSchema, invoiceLineRecordSchema } from "./financeBilling.js";
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
