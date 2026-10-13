/** Finance payment record schemas and soft-delete helpers. */
import { z } from "zod";
import { paymentAllocationInsertSchema, paymentAllocationRecordSchema } from "./financeBilling.js";
import { isoDateSchema } from "../core/isoDateSchema.js";

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
