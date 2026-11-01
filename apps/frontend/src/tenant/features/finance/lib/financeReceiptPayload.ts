/**
 * @file financeReceiptPayload.ts
 * @description Maps a finance invoice into the flat fee-receipt payload the finance
 * template binds to, so the editor preview and the print path agree on field names.
 */

import {
  getCollectedAmountForInvoice,
  getOutstandingAmountForInvoice,
  type TypstFeeReceiptPayload,
} from "@mms/shared";
import type { Invoice } from "@/lib/data/financeData";
import { mapToTypstFeeReceipt } from "@/components/template-editor/templatePayloadMappers";

export function buildFinanceReceiptPayload(
  invoice: Invoice,
  institution: string,
): TypstFeeReceiptPayload {
  const collected = getCollectedAmountForInvoice(invoice);
  const outstanding = getOutstandingAmountForInvoice(invoice);
  const isPaid = invoice.status === "paid";

  // Per-line paid amounts are not stored; a line is only "paid" when the whole
  // invoice is settled, otherwise the printout shows the charge with a blank paid cell
  // rather than claiming money was collected.
  const feeItems = (invoice.lines ?? []).map((line) => ({
    description: line.description || "Fee item",
    amount: String(line.amount),
    paid: isPaid ? String(line.amount) : "",
  }));

  const documentRef = invoice.invoiceNumber || invoice.id;

  return mapToTypstFeeReceipt({
    institution,
    receiptNo: documentRef,
    date: invoice.paidDate ?? invoice.dueDate,
    studentName: invoice.studentName,
    rollNo: invoice.studentId,
    className: [invoice.class, invoice.session].filter(Boolean).join(" · "),
    feeItems,
    // `mapToTypstFeeReceipt` builds its fallback row from `amount`.
    amount: String(invoice.finalAmt),
    totalAmount: String(invoice.finalAmt),
    paidAmount: String(collected),
    balance: String(outstanding),
    paymentMethod: invoice.method ?? "",
    transactionRef: documentRef,
  });
}
