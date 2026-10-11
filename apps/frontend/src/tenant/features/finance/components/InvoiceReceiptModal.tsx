import React, { useRef } from "react";
import { Printer, ReceiptText, FileCode2, CloudUpload } from "lucide-react";
import type { Invoice } from "@/lib/data/financeData";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { useTranslation } from "@/hooks/useTranslation";
import { ReceiptVoucher } from "./ReceiptVoucher";
import { useInvoiceReceiptActions } from "./useInvoiceReceiptActions";

export interface InvoiceReceiptModalProps {
  invoices: Invoice[];
  onClose: () => void;
  madrasaName?: string;
}

export const InvoiceReceiptModal = function InvoiceReceiptModal({
  invoices,
  onClose,
  madrasaName = "Madrasa Management System",
}: InvoiceReceiptModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const { handlePrint, handleExportTypst, handleExportZoho } = useInvoiceReceiptActions(
    invoices,
    madrasaName,
    printRef,
  );

  const title = invoices.length > 1 ? t("finance.printReceipts") : t("finance.printReceipt");

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      subtitle={`(${invoices.length})`}
      icon={ReceiptText}
      size="lg"
      hideFooter
      panelClassName="print:shadow-none print:border-0"
      headerActions={
        <div className="flex items-center gap-2 print:hidden">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportTypst}
            className="gap-1.5"
            title={t("templateEditor.exportTypst")}
          >
            <FileCode2 className="w-3.5 h-3.5 text-info" aria-hidden />
            <span>{t("templateEditor.typst")}</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportZoho}
            className="gap-1.5"
            title={t("templateEditor.exportZoho")}
          >
            <CloudUpload className="w-3.5 h-3.5 text-warning" aria-hidden />
            <span>{t("templateEditor.zoho")}</span>
          </Button>
          <Button size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="w-3.5 h-3.5" aria-hidden />
            {t("finance.printReceipt")}
          </Button>
        </div>
      }
    >
      <div ref={printRef} className="mx-auto w-full max-w-2xl space-y-6">
        {invoices.map((invoice) => (
          <ReceiptVoucher
            key={invoice.id}
            invoice={invoice}
            madrasaName={madrasaName ?? "Madrasa"}
          />
        ))}
      </div>
    </Modal>
  );
};

export default InvoiceReceiptModal;
