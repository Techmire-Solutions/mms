import { z } from "zod";
import { isoDateSchema } from "./isoDateSchema.js";
import { billingPeriodSchema } from "./billingPeriodSchema.js";

/** Decimal money string, per MMS currency convention (never IEEE 754 floats). */
const moneyDecimalStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount");

export const FEE_ENTRY_PAYMENT_METHODS = ["cash", "bank", "card", "online", "cheque"] as const;
export type FeeEntryPaymentMethod = (typeof FEE_ENTRY_PAYMENT_METHODS)[number];

const specializedEntryBaseSchema = z.object({
  date: isoDateSchema,
  note: z.string().max(500),
});

/**
 * Fee entry — General Entries "Fee" quick action. Bridges Finance (invoice +
 * instant collection) and Accounting (ledger posting) in one cross-module use
 * case.
 */
export const feeEntrySchema = specializedEntryBaseSchema
  .extend({
    type: z.literal("fee"),
    studentId: z.string().min(1, "Student is required"),
    /** Denormalised display name for the invoice directory, as the invoice form also supplies. */
    studentName: z.string(),
    feePeriod: billingPeriodSchema,
    amount: moneyDecimalStringSchema,
    paymentMethod: z.enum(FEE_ENTRY_PAYMENT_METHODS),
  })
  .strict();

/**
 * Salary entry — General Entries "Salary" quick action. Posts the expense and
 * the cash/bank deduction directly to the ledger. Both accounts are chosen by
 * the user: posting rules cover only AR / cash / income / discount, so there is
 * no configured expense account to fall back on.
 */
export const salaryEntrySchema = specializedEntryBaseSchema
  .extend({
    type: z.literal("salary"),
    staffId: z.string().min(1, "Staff member is required"),
    payPeriod: billingPeriodSchema,
    amount: moneyDecimalStringSchema,
    expenseAccountId: z.string().min(1, "Expense account is required"),
    paymentAccountId: z.string().min(1, "Payment account is required"),
  })
  .strict();

export const specializedEntrySchema = z.discriminatedUnion("type", [
  feeEntrySchema,
  salaryEntrySchema,
]);

export type FeeEntryInput = z.infer<typeof feeEntrySchema>;
export type SalaryEntryInput = z.infer<typeof salaryEntrySchema>;
export type SpecializedEntryInput = z.infer<typeof specializedEntrySchema>;

/**
 * `ledgerPosted` reports whether the ledger actually received the entry.
 * Finance postings are best-effort: `tryPost*Journal` silently skips when the
 * workspace has no posting rules configured, so the caller must not claim the
 * ledger was updated without checking.
 */
export const specializedEntryResultSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("fee"),
      invoiceId: z.string(),
      paymentId: z.string(),
      ledgerPosted: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal("salary"), entryId: z.string(), ledgerPosted: z.boolean() }).strict(),
]);
export type SpecializedEntryResult = z.infer<typeof specializedEntryResultSchema>;
