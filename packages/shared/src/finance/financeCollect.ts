import { z } from "zod";
import type { Invoice } from "./financeModuleManifest.js";
import { todayISO } from "../core/utils.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Late fee as a percent of `finalAmt`, rounded to cents. */
export function computeLateFee(finalAmt: number, lateFeePercent: number): number {
  if (finalAmt <= 0 || lateFeePercent <= 0) return 0;
  return Math.round(finalAmt * lateFeePercent) / 100;
}

/** True when `dueDate` is a calendar day strictly before `today`. */
export function isInvoicePastDue(dueDate: string, today = todayISO()): boolean {
  return DATE_RE.test(dueDate) && dueDate < today;
}

/** Pending, overdue, or partial — still collectible. */
export function isOpenCollectStatus(status: string): boolean {
  return status === "pending" || status === "overdue" || status === "partial";
}

/** Late fee once, only on past-due open invoices that have none yet. */
export function canApplyLateFee(
  invoice: Pick<Invoice, "status" | "dueDate" | "lateFeeAmt">,
  lateFeePercent: number,
  today = todayISO(),
): boolean {
  return (
    lateFeePercent > 0 &&
    (invoice.lateFeeAmt ?? 0) <= 0 &&
    isOpenCollectStatus(invoice.status) &&
    isInvoicePastDue(invoice.dueDate, today)
  );
}

/** Pending/partial invoices whose due date has passed. */
export function canMarkInvoiceOverdue(
  invoice: Pick<Invoice, "status" | "dueDate">,
  today = todayISO(),
): boolean {
  return (
    (invoice.status === "pending" || invoice.status === "partial") &&
    isInvoicePastDue(invoice.dueDate, today)
  );
}

/** Days before due date when a reminder may be sent (`reminderDaysBefore`). */
export function isInvoiceDueForReminder(
  dueDate: string,
  reminderDaysBefore: number,
  today = todayISO(),
): boolean {
  if (!DATE_RE.test(dueDate)) return false;
  if (dueDate < today) return true;
  const due = new Date(`${dueDate}T00:00:00.000Z`);
  const windowStart = new Date(due);
  windowStart.setUTCDate(windowStart.getUTCDate() - Math.max(0, reminderDaysBefore));
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  return todayDate >= windowStart && todayDate <= due;
}

/** True when a reminder was stamped within the last 24 hours. */
export function wasRemindedRecently(
  lastRemindedAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!lastRemindedAt) return false;
  const stamped = Date.parse(lastRemindedAt);
  if (!Number.isFinite(stamped)) return false;
  return nowMs - stamped < 24 * 60 * 60 * 1000;
}

/** Open AR: final + late fee − credits − paid. Paid/cancelled invoices are 0. */
export function invoiceOpenBalance(
  invoice: Pick<Invoice, "status" | "finalAmt" | "paidAmt" | "lateFeeAmt" | "creditedAmt">,
): number {
  if (invoice.status === "cancelled" || invoice.status === "paid") return 0;
  const paid = invoice.paidAmt ?? 0;
  const late = invoice.lateFeeAmt ?? 0;
  const credited = invoice.creditedAmt ?? 0;
  return Math.max(0, invoice.finalAmt + late - credited - paid);
}

/**
 * Unpaid, uncredited invoices that are not already cancelled or paid.
 *
 * `creditedAmt` is part of the rule because a credit note posts its own
 * Dr Income / Cr AR entry. Cancelling an invoice reverses only the invoice
 * entry, so a partial credit left behind produced a credit AR balance and
 * negative revenue (invoice 100, credit 30, cancel → AR −30, income −30) while
 * every entry still balanced individually. Credit notes must be reversed first.
 */
export function canCancelInvoice(
  invoice: Pick<Invoice, "status" | "paidAmt" | "creditedAmt">,
): boolean {
  return (
    invoice.status !== "cancelled" &&
    invoice.status !== "paid" &&
    (invoice.paidAmt ?? 0) <= 0 &&
    (invoice.creditedAmt ?? 0) <= 0
  );
}

/** Credit notes may not exceed the current open balance. */
export function canCreditInvoice(
  invoice: Pick<Invoice, "status" | "finalAmt" | "paidAmt" | "lateFeeAmt" | "creditedAmt">,
  amount: number,
): boolean {
  return amount > 0 && isOpenCollectStatus(invoice.status) && amount <= invoiceOpenBalance(invoice);
}

/** Guardian, then father, then the student contact — the family AR party. */
export function resolveFamilyContactId(
  student?: {
    guardianContactId?: string | number | null;
    fatherContactId?: string | number | null;
    contactId?: string | number | null;
  } | null,
): string | null {
  const raw = student?.guardianContactId ?? student?.fatherContactId ?? student?.contactId ?? null;
  if (raw == null || raw === "") return null;
  return String(raw);
}

export const collectInvoicesBodySchema = z
  .object({
    applyLateFee: z.boolean().optional().default(true),
  })
  .strict();

export type CollectInvoicesBody = z.input<typeof collectInvoicesBodySchema>;

export const collectInvoicesResultSchema = z
  .object({
    markedOverdue: z.number().int().nonnegative(),
    lateFeesApplied: z.number().int().nonnegative(),
  })
  .strict();

export type CollectInvoicesResult = z.infer<typeof collectInvoicesResultSchema>;

export const remindInvoicesBodySchema = z
  .object({
    invoiceIds: z.array(z.string().min(1)).max(100).optional(),
  })
  .strict();

export type RemindInvoicesBody = z.input<typeof remindInvoicesBodySchema>;

export const invoiceReminderRecipientSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    phone: z.string(),
    email: z.string().optional(),
    invoiceId: z.string(),
    dueDate: z.string(),
    amount: z.number().nonnegative(),
  })
  .strict();

export const remindInvoicesResultSchema = z
  .object({
    reminded: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    recipients: z.array(invoiceReminderRecipientSchema),
  })
  .strict();

export type RemindInvoicesResult = z.infer<typeof remindInvoicesResultSchema>;

export const creditNoteRecordSchema = z
  .object({
    id: z.string(),
    invoiceId: z.string(),
    amount: z.number().positive(),
    reason: z.string().default(""),
    createdAt: z.string().optional(),
  })
  .strict();

export const creditNoteInsertSchema = z
  .object({
    invoiceId: z.string().min(1),
    amount: z.number().positive(),
    reason: z.string().max(200).optional().default(""),
  })
  .strict();

export type CreditNote = z.infer<typeof creditNoteRecordSchema>;
export type CreditNoteInsert = z.input<typeof creditNoteInsertSchema>;

export const creditNotesQuerySchema = z
  .object({
    invoiceId: z.string().min(1),
  })
  .strict();

export type CreditNotesQuery = z.infer<typeof creditNotesQuerySchema>;
