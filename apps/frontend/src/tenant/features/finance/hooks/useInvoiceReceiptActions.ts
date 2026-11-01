/**
 * @file useInvoiceReceiptActions.ts
 * @description Data exports for the finance receipt modal (Typst / Zoho).
 *
 * Printing is owned by the modal through the shared `printTemplateDocument` helper so
 * the printed page is the designed template, not a hand-built receipt stylesheet.
 */

import { useCallback } from "react";
import { getOutstandingAmountForInvoice, type ZohoInvoicePayload } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import type { Invoice } from "@/lib/data/financeData";
import { mapToZohoInvoice } from "@/components/template-editor/templatePayloadMappers";
import { notify } from "@/lib/notify";
import { buildFinanceReceiptPayload } from "../lib/financeReceiptPayload";

export function useInvoiceReceiptActions(invoices: Invoice[], institution: string) {
  const { t } = useTranslation();

  const handleExportTypst = useCallback(() => {
    if (invoices.length === 0) return;
    for (const invoice of invoices) {
      const payload = buildFinanceReceiptPayload(invoice, institution);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `typst-fee-receipt-${invoice.invoiceNumber || invoice.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    notify.success(
      invoices.length > 1
        ? `${invoices.length} Typst fee-receipt payloads exported`
        : "Typst fee-receipt payload exported",
    );
  }, [institution, invoices]);

  const handleExportZoho = useCallback(() => {
    const invoice = invoices[0];
    if (!invoice) return;
    if (invoices.length > 1) {
      notify.info(t("finance.receipt.zohoSingleInvoiceNote"));
    }
    const outstanding = getOutstandingAmountForInvoice(invoice);
    const payload: ZohoInvoicePayload = mapToZohoInvoice({
      invoice_number: invoice.invoiceNumber || invoice.id,
      date: invoice.paidDate ?? invoice.dueDate,
      due_date: invoice.dueDate,
      customer_name: invoice.studentName,
      customer_id: invoice.studentId,
      line_items: [
        {
          name: "Tuition Fee",
          rate: invoice.finalAmt,
          quantity: 1,
          item_total: invoice.finalAmt,
        },
      ],
      total: invoice.finalAmt,
      balance: outstanding,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zoho-invoice-${invoice.invoiceNumber || invoice.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success(t("finance.zohoExported"));
  }, [invoices, t]);

  return {
    handleExportTypst,
    handleExportZoho,
  };
}
