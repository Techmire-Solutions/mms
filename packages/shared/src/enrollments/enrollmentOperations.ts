import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";

/** Typed timeline events written by the server for mid-session operations. */
export const ENROLLMENT_EVENT_TYPES = [
  "placed",
  "transferred",
  "withdrawn",
  "readmitted",
  "suspended",
  "cancelled",
  "promoted",
  "retained",
  "graduated",
  "left",
] as const;
export type EnrollmentEventType = (typeof ENROLLMENT_EVENT_TYPES)[number];

/** Student statuses that end the student's live enrollments (Phase 9e); `suspended` does not. */
export const ENROLLMENT_ENDING_STUDENT_STATUSES = ["inactive", "transferred", "graduated"] as const;

/** Whether a student status change from `before` to `after` should withdraw live enrollments. */
export function studentStatusEndsEnrollments(
  before: string | null | undefined,
  after: string | null | undefined,
): boolean {
  const ending = (status: string | null | undefined) =>
    (ENROLLMENT_ENDING_STUDENT_STATUSES as readonly string[]).includes(
      String(status ?? "")
        .trim()
        .toLowerCase(),
    );
  return ending(after) && !ending(before);
}

const reasonSchema = z.string().trim().min(3, "Give a reason").max(500);

/** Move an enrollment to another class/section of the same session from a date. */
export const enrollmentTransferBodySchema = z
  .object({
    classId: z.string().trim().min(1).max(64),
    sectionId: z.string().trim().min(1).max(64).nullable().optional(),
    effectiveOn: isoDateSchema,
    reason: reasonSchema,
  })
  .strict();
export type EnrollmentTransferBody = z.infer<typeof enrollmentTransferBodySchema>;

/** End an enrollment from a date (drop-out, transfer out); the seat is released. */
export const enrollmentWithdrawBodySchema = z
  .object({
    effectiveOn: isoDateSchema,
    reason: reasonSchema,
  })
  .strict();
export type EnrollmentWithdrawBody = z.infer<typeof enrollmentWithdrawBodySchema>;

/** Bring a withdrawn student back from a date (optionally into another class/section). */
export const enrollmentReadmitBodySchema = z
  .object({
    classId: z.string().trim().min(1).max(64).optional(),
    sectionId: z.string().trim().min(1).max(64).nullable().optional(),
    effectiveOn: isoDateSchema,
    reason: reasonSchema,
  })
  .strict();
export type EnrollmentReadmitBody = z.infer<typeof enrollmentReadmitBodySchema>;

/** Suspension / long leave: an approved leave range; those days do not count toward rates. */
export const enrollmentSuspendBodySchema = z
  .object({ fromOn: isoDateSchema, toOn: isoDateSchema, reason: reasonSchema })
  .strict()
  .refine((body) => body.toOn >= body.fromOn, {
    message: "The leave must end on or after it starts",
    path: ["toOn"],
  });
export type EnrollmentSuspendBody = z.infer<typeof enrollmentSuspendBodySchema>;

/** One dated placement of an enrollment (class × section over [startOn, endOn]). */
export const enrollmentPlacementSchema = z
  .object({
    id: z.string(),
    enrollmentId: z.string(),
    classId: z.string(),
    sectionId: z.string().nullable(),
    startOn: z.string(),
    endOn: z.string().nullable(),
    reason: z.string().nullable(),
  })
  .strict();
export type EnrollmentPlacement = z.infer<typeof enrollmentPlacementSchema>;

/** Invoice fields the withdrawal billing rule reads. */
export interface WithdrawalInvoice {
  id: string;
  invoiceNumber?: string | null;
  status: string;
  billingPeriod?: string | null;
  paidAmt?: number | null;
  creditedAmt?: number | null;
}

/**
 * Billing effect of a withdrawal on the enrollment's invoices: the period that contains the last
 * day is charged in full; later periods are cancelled when untouched (no payment, no credit) and
 * otherwise left for a staff refund decision. Cancelled invoices are ignored.
 */
export function withdrawalInvoicePlan(
  invoices: readonly WithdrawalInvoice[],
  lastDay: string,
): { cancel: WithdrawalInvoice[]; review: WithdrawalInvoice[] } {
  const lastPeriod = lastDay.slice(0, 7);
  const later = invoices.filter(
    (invoice) =>
      invoice.status !== "cancelled" &&
      Boolean(invoice.billingPeriod) &&
      String(invoice.billingPeriod).slice(0, 7) > lastPeriod,
  );
  const untouched = (invoice: WithdrawalInvoice) =>
    invoice.status !== "paid" && (invoice.paidAmt ?? 0) <= 0 && (invoice.creditedAmt ?? 0) <= 0;
  return {
    cancel: later.filter(untouched),
    review: later.filter((invoice) => !untouched(invoice)),
  };
}

const invoiceRefSchema = z
  .object({ id: z.string(), invoiceNumber: z.string().nullable() })
  .strict();

/** What a withdrawal did to the enrollment's invoices (returned to the caller for follow-up). */
export const withdrawalBillingOutcomeSchema = z
  .object({ cancelled: z.array(invoiceRefSchema), review: z.array(invoiceRefSchema) })
  .strict();
export type WithdrawalBillingOutcome = z.infer<typeof withdrawalBillingOutcomeSchema>;
