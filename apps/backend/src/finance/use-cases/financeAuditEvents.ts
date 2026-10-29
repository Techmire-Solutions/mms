import type { AuditActionType, CreditNote, Invoice, Payment } from "@mms/shared";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

/** Minimised invoice state for the audit chain — ids, status and amounts only. */
export interface InvoiceAuditState {
  id: string;
  studentId: string;
  status: string;
  finalAmt: number;
  paidAmt: number;
  creditedAmt: number;
  dueDate: string;
  /** Distinguishes a settlement event (cancel) from a plain field update. */
  event?: string;
}

export interface PaymentAuditState {
  id: string;
  invoiceId: string;
  studentId: string | null;
  amount: number;
  invoiceAmount: number;
  date: string;
  method: string;
}

export function invoiceAuditState(
  invoice: Invoice | null | undefined,
  event?: string,
): InvoiceAuditState | null {
  if (!invoice) return null;
  return {
    id: invoice.id,
    studentId: invoice.studentId,
    status: invoice.status,
    finalAmt: Number(invoice.finalAmt ?? 0),
    paidAmt: Number(invoice.paidAmt ?? 0),
    creditedAmt: Number(invoice.creditedAmt ?? 0),
    dueDate: invoice.dueDate,
    ...(event ? { event } : {}),
  };
}

export function paymentAuditState(payment: Payment): PaymentAuditState {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    studentId: payment.studentId ?? null,
    amount: Number(payment.amount ?? 0),
    invoiceAmount: Number(payment.invoiceAmount ?? payment.amount ?? 0),
    date: payment.date,
    method: payment.method ?? "",
  };
}

/**
 * Appends an invoice audit row inside the caller's transaction. `studentName`
 * and other person-level fields are deliberately excluded.
 */
export async function recordInvoiceAudit(
  tenant: string,
  actionType: AuditActionType,
  invoice: Invoice | null | undefined,
  oldState?: InvoiceAuditState | null,
  event?: string,
): Promise<void> {
  const newState = invoiceAuditState(invoice, event);
  if (!newState) return;
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: "finance_invoices",
    recordId: newState.id,
    actionType,
    oldState: oldState ?? undefined,
    newState,
  });
}

export async function recordPaymentAudit(tenant: string, payment: Payment): Promise<void> {
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: "finance_payments",
    recordId: payment.id,
    actionType: "CREATE",
    newState: paymentAuditState(payment),
  });
}

export async function recordCreditNoteAudit(
  tenant: string,
  note: CreditNote,
  creditedAmt: number,
): Promise<void> {
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: "finance_credit_notes",
    recordId: note.id,
    actionType: "CREATE",
    newState: {
      id: note.id,
      invoiceId: note.invoiceId,
      amount: Number(note.amount ?? 0),
      creditedAmt: Number(creditedAmt ?? 0),
    },
  });
}
