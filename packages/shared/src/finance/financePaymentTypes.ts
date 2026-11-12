/** Finance payment record schemas and soft-delete helpers. */
import { z } from "zod";
import { paymentAllocationInsertSchema, paymentAllocationRecordSchema } from "./financeBilling.js";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { documentFxFields } from "./financeDocumentFx.js";
import { FINANCE_PAYMENT_METHODS, normalizePaymentMethod } from "./accountingEnums.js";
import {
  positiveMoneyAmountSchema,
  signedMoneyAmountSchema,
} from "./accountingLedgerInvariants.js";

/** Canonicalizes legacy lowercase/snake-case methods before the enum check. */
export const paymentMethodSchema = z.preprocess(
  (value) => (typeof value === "string" ? normalizePaymentMethod(value) : value),
  z.enum(FINANCE_PAYMENT_METHODS),
);

/** Stored rows may predate the canonical vocabulary; read leniently, write strictly. */
const storedPaymentMethodSchema = paymentMethodSchema.catch("Other");

export const paymentRecordSchema = z
  .object({
    id: z.string(),
    invoiceId: z.string(),
    studentId: z.string().nullable().optional(),
    studentName: z.string().nullable().optional(),
    amount: positiveMoneyAmountSchema,
    date: z.string(),
    method: storedPaymentMethodSchema.default("Cash"),
    receivedByUserId: z.string().nullable().optional(),
    receivedBy: z.string().nullable().optional(),
    note: z.string().default(""),
    /** Same as the invoice's currency; `exchangeRate` is the settlement (payment-date) rate. */
    ...documentFxFields,
    /** Server-computed realized FX gain (+) / loss (−) in the functional currency. */
    realizedFx: signedMoneyAmountSchema.optional(),
    /** Server-computed amount applied to the invoice, in the invoice currency. */
    invoiceAmount: positiveMoneyAmountSchema.optional(),
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
    amount: positiveMoneyAmountSchema,
    date: isoDateSchema,
    method: paymentMethodSchema.optional().default("Cash"),
    receivedByUserId: z.string().nullable().optional(),
    receivedBy: z.string().nullable().optional(),
    note: z.string().optional().default(""),
    ...documentFxFields,
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
