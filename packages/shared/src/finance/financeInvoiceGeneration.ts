import { z } from "zod";
import { type FeeFrequency } from "./financeBilling.js";
import { BILLING_PERIOD_PATTERN, billingPeriodSchema } from "../core/billingPeriodSchema.js";

/** Calendar month key `YYYY-MM` used to prevent double-billing. */
export function billingPeriodFromDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate.trim());
  if (!match) {
    throw new Error("Date must be YYYY-MM-DD to derive a billing period");
  }
  return `${match[1]}-${match[2]}`;
}

/** True when `value` is a calendar month key `YYYY-MM`. */
export function isBillingPeriod(value: string): boolean {
  return BILLING_PERIOD_PATTERN.test(value.trim());
}

/** Day-of-month from `dueDays`, clamped to the last day of `period`. */
export function dueDateForPeriod(period: string, dueDays: number): string {
  if (!isBillingPeriod(period)) {
    throw new Error("Billing period must be YYYY-MM");
  }
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(1, dueDays), lastDay);
  return `${period}-${String(day).padStart(2, "0")}`;
}

export interface EnrollmentBillingSource {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  sessionName: string;
  sessionId: string;
  classId: string;
  enrolledDate: string;
  baseFee: number;
  discountType?: string | null;
  discountPct?: number;
  discountAmt?: number;
  finalFee: number;
  invoiceId?: string | null;
  status: string;
}

export interface GeneratedInvoiceDraft {
  studentId: string;
  studentName: string;
  class: string;
  session: string;
  baseFee: number;
  discountType: string | null;
  discountValue: number;
  discountAmt: number;
  finalAmt: number;
  status: "pending";
  dueDate: string;
  paidAmt: number;
  billingPeriod: string;
  enrollmentId: string;
}

/**
 * Build a pending invoice from an enrollment for one billing period.
 * Uses `finalFee` when set, otherwise `baseFee`.
 */
export function buildInvoiceDraftFromEnrollment(
  enrollment: EnrollmentBillingSource,
  billingPeriod: string,
  dueDays: number,
): GeneratedInvoiceDraft {
  const finalAmt = enrollment.finalFee > 0 ? enrollment.finalFee : enrollment.baseFee;
  const discountAmt = enrollment.discountAmt ?? 0;
  const baseFee = enrollment.baseFee > 0 ? enrollment.baseFee : finalAmt + discountAmt;
  return {
    studentId: enrollment.studentId,
    studentName: enrollment.studentName,
    class: enrollment.className,
    session: enrollment.sessionName,
    baseFee,
    discountType:
      enrollment.discountType && enrollment.discountType !== "none"
        ? enrollment.discountType
        : null,
    discountValue: enrollment.discountPct ?? 0,
    discountAmt,
    finalAmt: Math.max(0, finalAmt),
    status: "pending",
    dueDate: dueDateForPeriod(billingPeriod, dueDays),
    paidAmt: 0,
    billingPeriod,
    enrollmentId: enrollment.id,
  };
}

/** Pending and confirmed enrollments are in the billing cycle. */
export function isEnrollmentBillable(enrollment: Pick<EnrollmentBillingSource, "status">): boolean {
  return enrollment.status === "pending" || enrollment.status === "confirmed";
}

/**
 * `once` fees are skipped when the enrollment already has any invoice.
 * Monthly/term fees are skipped when this period was already billed.
 */
export function shouldSkipGeneratedInvoice(input: {
  frequency: FeeFrequency;
  alreadyBilledThisPeriod: boolean;
  enrollmentHasAnyInvoice: boolean;
}): boolean {
  if (input.frequency === "once") return input.enrollmentHasAnyInvoice;
  return input.alreadyBilledThisPeriod;
}

/** POST /api/finance/invoices/generate */
export const generateInvoicesBodySchema = z
  .object({
    billingPeriod: billingPeriodSchema,
    sessionId: z.string().max(64).optional(),
    classId: z.string().max(64).optional(),
    enrollmentIds: z.array(z.string().min(1)).max(100).optional(),
  })
  .strict();

export type GenerateInvoicesBody = z.infer<typeof generateInvoicesBodySchema>;

export const generateInvoicesResultSchema = z
  .object({
    created: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    eligible: z.number().int().nonnegative(),
  })
  .strict();

export type GenerateInvoicesResult = z.infer<typeof generateInvoicesResultSchema>;
