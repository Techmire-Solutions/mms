/**
 * @file templatePayloadMappers.ts
 * @description Direct payload mappers for Typst compiler engine and Zoho Invoice API schemas.
 * Converts template field mappings and domain entity records directly into conforming payloads.
 */

import {
  DEFAULT_CURRENCY_CODE,
  typstFeeReceiptPayloadSchema,
  type TypstFeeReceiptPayload,
  typstReportCardPayloadSchema,
  type TypstReportCardPayload,
  typstFinancialLedgerPayloadSchema,
  type TypstFinancialLedgerPayload,
  zohoInvoicePayloadSchema,
  type ZohoInvoicePayload,
  type DocumentTemplate,
} from "@mms/shared";

/**
 * Maps raw entity records into the exact JSON structure expected by apps/backend/src/worker/templates/fee-receipt.typ.
 */
export function mapToTypstFeeReceipt(
  data: Record<string, unknown>,
  _template?: DocumentTemplate,
): TypstFeeReceiptPayload {
  const feeItemsRaw = Array.isArray(data.feeItems) ? data.feeItems : [];
  const feeItems = feeItemsRaw.map((item) => {
    const it = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    return {
      description: String(it.description ?? it.name ?? "Fee Item"),
      amount: String(it.amount ?? "0.00"),
      paid: String(it.paid ?? it.amount ?? "0.00"),
    };
  });

  const rawPayload = {
    institution: String(data.institution ?? data.madrasaName ?? "Madrasa Management System"),
    receiptNo: String(
      data.receiptNo ?? data.receipt_no ?? data.invoiceNumber ?? data.id ?? "REC-0000",
    ),
    date: String(data.date ?? data.received_date ?? new Date().toISOString().slice(0, 10)),
    studentName: String(data.studentName ?? data.student_name ?? data.sender ?? "-"),
    rollNo: String(data.rollNo ?? data.roll_no ?? data.rollNumber ?? "-"),
    className: String(data.className ?? data.class_name ?? data.class ?? "-"),
    feeItems:
      feeItems.length > 0
        ? feeItems
        : [
            {
              description: "General Obligation / Fee",
              amount: String(data.amount ?? "0.00"),
              paid: String(data.paidAmount ?? data.amount ?? "0.00"),
            },
          ],
    totalAmount: String(data.totalAmount ?? data.total ?? data.amount ?? "0.00"),
    paidAmount: String(data.paidAmount ?? data.paid ?? data.amount ?? "0.00"),
    balance: String(data.balance ?? data.outstanding ?? "0.00"),
    paymentMethod: String(data.paymentMethod ?? data.payment_mode ?? "نقداً / Cash"),
    transactionRef: String(data.transactionRef ?? data.reference ?? data.id ?? "-"),
  };

  return typstFeeReceiptPayloadSchema.parse(rawPayload);
}

/**
 * Maps student exam evaluation data into the exact JSON structure expected by apps/backend/src/worker/templates/report-card.typ.
 */
export function mapToTypstReportCard(
  data: Record<string, unknown>,
  _template?: DocumentTemplate,
): TypstReportCardPayload {
  const subjectsRaw = Array.isArray(data.subjects) ? data.subjects : [];
  const subjects = subjectsRaw.map((subj) => {
    const s = (typeof subj === "object" && subj !== null ? subj : {}) as Record<string, unknown>;
    return {
      name: String(s.name ?? "Subject"),
      maxMarks: Number(s.maxMarks ?? 100),
      obtainedMarks: Number(s.obtainedMarks ?? 0),
      grade: String(s.grade ?? "-"),
      remarks: String(s.remarks ?? ""),
    };
  });

  const rawPayload = {
    institution: String(data.institution ?? data.madrasaName ?? "Madrasa Management System"),
    studentName: String(data.studentName ?? "الطالب"),
    rollNumber: String(data.rollNumber ?? data.rollNo ?? "-"),
    className: String(data.className ?? "-"),
    term: String(data.term ?? "نهاية الفصل الدراسي"),
    academicYear: String(data.academicYear ?? "1447-1448"),
    subjects,
    totalMarks: Number(data.totalMarks ?? 0),
    obtainedMarks: Number(data.obtainedMarks ?? 0),
    percentage: String(data.percentage ?? "0%"),
    grade: String(data.grade ?? "ممتاز"),
    attendance: String(data.attendance ?? "100%"),
    remarks: String(data.remarks ?? "مستوى ممتاز وتقدم ملحوظ"),
  };

  return typstReportCardPayloadSchema.parse(rawPayload);
}

/**
 * Maps ledger transaction records into the exact JSON structure expected by apps/backend/src/worker/templates/financial-ledger.typ.
 */
export function mapToTypstFinancialLedger(
  data: Record<string, unknown>,
  _template?: DocumentTemplate,
): TypstFinancialLedgerPayload {
  const entriesRaw = Array.isArray(data.entries) ? data.entries : [];
  const entries = entriesRaw.map((entry) => {
    const e = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
    return {
      date: String(e.date ?? "-"),
      accountCode: String(e.accountCode ?? "-"),
      description: String(e.description ?? "-"),
      debit: String(e.debit ?? "0.00"),
      credit: String(e.credit ?? "0.00"),
      balance: String(e.balance ?? "0.00"),
    };
  });

  const rawPayload = {
    institution: String(data.institution ?? data.madrasaName ?? "Madrasa Management System"),
    period: String(data.period ?? "الفترة المالية الحالية"),
    currency: String(data.currency ?? DEFAULT_CURRENCY_CODE),
    entries,
    totalDebit: String(data.totalDebit ?? "0.00"),
    totalCredit: String(data.totalCredit ?? "0.00"),
    netBalance: String(data.netBalance ?? "0.00"),
  };

  return typstFinancialLedgerPayloadSchema.parse(rawPayload);
}

/**
 * Maps document or billing invoice records into the standard Zoho Invoice API synchronization payload format.
 */
export function mapToZohoInvoice(
  data: Record<string, unknown>,
  _template?: DocumentTemplate,
): ZohoInvoicePayload {
  const rawLineItems = Array.isArray(data.line_items ?? data.lineItems ?? data.feeItems)
    ? ((data.line_items ?? data.lineItems ?? data.feeItems) as unknown[])
    : [];

  const line_items = rawLineItems.map((item) => {
    const it = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    return {
      item_id: it.item_id ? String(it.item_id) : undefined,
      name: String(it.name ?? it.description ?? "Line Item"),
      description: it.description ? String(it.description) : undefined,
      rate: typeof it.rate === "number" ? it.rate : String(it.amount ?? it.rate ?? "0.00"),
      quantity: Number(it.quantity ?? 1),
      item_total:
        it.item_total != null
          ? typeof it.item_total === "number"
            ? it.item_total
            : String(it.item_total)
          : undefined,
    };
  });

  const rawPayload = {
    invoice_number: String(
      data.invoice_number ?? data.invoiceNumber ?? data.receiptNo ?? data.id ?? "INV-0001",
    ),
    date: String(data.date ?? data.created_at ?? new Date().toISOString().slice(0, 10)),
    due_date: String(
      data.due_date ?? data.dueDate ?? data.date ?? new Date().toISOString().slice(0, 10),
    ),
    customer_id: data.customer_id ? String(data.customer_id) : undefined,
    customer_name: String(
      data.customer_name ?? data.studentName ?? data.sender ?? "Valued Customer",
    ),
    line_items:
      line_items.length > 0
        ? line_items
        : [
            {
              name: "Invoice Charge",
              rate: String(data.amount ?? data.total ?? "0.00"),
              quantity: 1,
            },
          ],
    total:
      typeof data.total === "number"
        ? data.total
        : String(data.total ?? data.totalAmount ?? data.amount ?? "0.00"),
    balance:
      typeof data.balance === "number"
        ? data.balance
        : String(data.balance ?? data.outstanding ?? "0.00"),
    notes: data.notes ? String(data.notes) : undefined,
    terms: data.terms ? String(data.terms) : undefined,
    currency_code: data.currency_code
      ? String(data.currency_code)
      : data.currency
        ? String(data.currency)
        : DEFAULT_CURRENCY_CODE,
  };

  return zohoInvoicePayloadSchema.parse(rawPayload);
}
