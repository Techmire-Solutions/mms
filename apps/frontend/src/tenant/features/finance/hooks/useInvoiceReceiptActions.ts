import { useCallback, type RefObject } from "react";
import type { Invoice } from "@/lib/data/financeData";
import { useTranslation } from "@/hooks/useTranslation";
import { getCollectedAmountForInvoice, getOutstandingAmountForInvoice } from "@mms/shared";
import {
  mapToTypstFeeReceipt,
  mapToZohoInvoice,
} from "@/components/template-editor/templatePayloadMappers";
import { notify } from "@/lib/notify";
import {
  buildPrintBodyStyle,
  PRINT_NEUTRAL_PALETTE,
  PRINT_COLORS,
} from "@/lib/ui/printTemplateStyles";

export function useInvoiceReceiptActions(
  invoices: Invoice[],
  madrasaName: string,
  printRef: RefObject<HTMLDivElement | null>,
) {
  const { t } = useTranslation();

  const handlePrint = useCallback(() => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    win.opener = null;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${t("finance.receipt.title")}</title>
          <style>
            ${buildPrintBodyStyle()}
            .receipt-voucher { border: 1px solid ${PRINT_COLORS.borderLight}; border-radius: 12px; padding: 24px; margin-bottom: 20px; page-break-after: always; }
            .receipt-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid ${PRINT_COLORS.borderLight}; padding-bottom: 16px; margin-bottom: 16px; }
            .receipt-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13px; margin-bottom: 12px; }
            .receipt-section { border: 1px solid ${PRINT_COLORS.borderLight}; border-radius: 8px; overflow: hidden; margin-bottom: 12px; }
            .receipt-row { display: flex; justify-content: space-between; padding: 8px 16px; font-size: 13px; border-bottom: 1px solid ${PRINT_COLORS.borderLighter}; }
            .receipt-row:last-child { border-bottom: none; }
            .highlight { background: ${PRINT_COLORS.highlightBg}; font-weight: 700; }
            .sig-block { border-bottom: 1px dashed ${PRINT_COLORS.ruleGray}; height: 40px; margin-bottom: 6px; }
            .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; border-top: 1px solid ${PRINT_COLORS.borderLight}; padding-top: 16px; margin-top: 16px; }
            .label { font-size: 11px; color: ${PRINT_NEUTRAL_PALETTE.caption}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
            .muted { color: ${PRINT_NEUTRAL_PALETTE.caption}; }
            .bold { font-weight: 700; }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    void win.document.fonts.ready.then(() => {
      win.print();
      win.close();
    });
  }, [printRef, t]);

  const handleExportTypst = useCallback(() => {
    if (invoices.length === 0) return;
    for (const inv of invoices) {
      const collected = getCollectedAmountForInvoice(inv);
      const outstanding = getOutstandingAmountForInvoice(inv);
      const payload = mapToTypstFeeReceipt({
        institution: madrasaName,
        receiptNo: inv.id,
        date: inv.paidDate ?? inv.dueDate,
        studentName: inv.studentName,
        rollNo: inv.studentId,
        className: `${inv.class} · ${inv.session}`,
        feeItems: [
          {
            description: "Tuition Fee",
            amount: String(inv.finalAmt),
            paid: String(collected),
          },
        ],
        totalAmount: String(inv.finalAmt),
        paidAmount: String(collected),
        balance: String(outstanding),
        paymentMethod: inv.method ?? "Cash",
        transactionRef: inv.id,
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `typst-fee-receipt-${inv.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    notify.success(
      invoices.length > 1
        ? `${invoices.length} Typst fee-receipt payloads exported`
        : "Typst fee-receipt payload exported",
    );
  }, [invoices, madrasaName]);

  const handleExportZoho = useCallback(() => {
    const inv = invoices[0];
    if (!inv) return;
    if (invoices.length > 1) {
      notify.info(t("finance.receipt.zohoSingleInvoiceNote"));
    }
    const outstanding = getOutstandingAmountForInvoice(inv);
    const payload = mapToZohoInvoice({
      invoice_number: inv.id,
      date: inv.paidDate ?? inv.dueDate,
      due_date: inv.dueDate,
      customer_name: inv.studentName,
      customer_id: inv.studentId,
      line_items: [
        {
          name: "Tuition Fee",
          rate: inv.finalAmt,
          quantity: 1,
          item_total: inv.finalAmt,
        },
      ],
      total: inv.finalAmt,
      balance: outstanding,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zoho-invoice-${inv.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success(t("finance.zohoExported"));
  }, [invoices, t]);

  return {
    handlePrint,
    handleExportTypst,
    handleExportZoho,
  };
}
