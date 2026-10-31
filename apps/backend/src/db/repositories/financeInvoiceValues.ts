import { type Invoice } from "@mms/shared";
import type { financeInvoices } from "../schema.js";
import { mapAuditToInsert } from "./repositoryMappers.js";
import { requireDbDate, requireDbDateValue } from "../../lib/dbDate.js";

export type FinanceInvoiceInsert = typeof financeInvoices.$inferInsert;

export function invoiceWriteValues(subdomain: string, record: Invoice): FinanceInvoiceInsert {
  return {
    id: record.id,
    workspaceSubdomain: subdomain,
    studentId: record.studentId,
    studentName: record.studentName ?? "",
    class: record.class ?? "",
    session: record.session ?? "",
    baseFee: String(record.baseFee ?? 0),
    discountType: record.discountType ?? null,
    discountValue: String(record.discountValue ?? 0),
    discountAmt: String(record.discountAmt ?? 0),
    finalAmt: String(record.finalAmt ?? 0),
    status: record.status ?? "pending",
    dueDate: requireDbDateValue(record.dueDate, "dueDate"),
    paidDate: requireDbDate(record.paidDate, "paidDate"),
    method: record.method ?? null,
    paidAmt: record.paidAmt != null ? String(record.paidAmt) : null,
    invoiceNumber: record.invoiceNumber ?? null,
    feeStructureId: record.feeStructureId ?? null,
    billingPeriod: record.billingPeriod ?? null,
    enrollmentId: record.enrollmentId ?? null,
    familyContactId: record.familyContactId ?? null,
    lateFeeAmt: String(record.lateFeeAmt ?? 0),
    creditedAmt: String(record.creditedAmt ?? 0),
    lastRemindedAt: record.lastRemindedAt ? new Date(record.lastRemindedAt) : null,
    reminderCount: record.reminderCount ?? 0,
    // Insert-only: upsert conflict sets omit these, so a document's currency and
    // booked rate never change after creation (IAS 21 historical rate).
    currency: record.currency ?? null,
    exchangeRate: record.exchangeRate ?? null,
    ...mapAuditToInsert(record),
  } satisfies FinanceInvoiceInsert;
}
