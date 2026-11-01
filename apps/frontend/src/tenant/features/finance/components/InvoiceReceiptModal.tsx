/**
 * @file InvoiceReceiptModal.tsx
 * @description Finance receipt preview and print, rendered from the tenant's saved
 * fee-receipt template (`/api/templates/:key`) with the factory layout as fallback.
 */

import React, { useRef } from "react";
import { Printer, ReceiptText, FileCode2, CloudUpload } from "lucide-react";
import { getPageDimensions } from "@mms/shared";
import type { Invoice } from "@/lib/data/financeData";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/app/Modal";
import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import { notify } from "@/lib/notify";
import { useDocumentTemplate } from "@/lib/templates/useDocumentTemplates";
import { TemplateDocumentPreview } from "@/components/template-editor/TemplateDocumentPreview";
import { printTemplateDocument } from "@/components/template-editor/templateDocumentPrint";
import { DEFAULT_FINANCE_TEMPLATE, FINANCE_TEMPLATE_STORAGE_KEY } from "../lib/financeTemplateData";
import { buildFinanceReceiptPayload } from "../lib/financeReceiptPayload";
import { useInvoiceReceiptActions } from "../hooks/useInvoiceReceiptActions";

export interface InvoiceReceiptModalProps {
  invoices: Invoice[];
  onClose: () => void;
}

export const InvoiceReceiptModal = function InvoiceReceiptModal({
  invoices,
  onClose,
}: InvoiceReceiptModalProps): React.JSX.Element {
  const { t, language, isRtl } = useTranslation();
  const branding = useBranding();
  const { template } = useDocumentTemplate(FINANCE_TEMPLATE_STORAGE_KEY, DEFAULT_FINANCE_TEMPLATE);
  const printRef = useRef<HTMLDivElement>(null);
  const { handleExportTypst, handleExportZoho } = useInvoiceReceiptActions(
    invoices,
    branding.madrasaName,
  );

  const size = getPageDimensions(template.pageSize, template.orientation);
  const payloads = invoices.map((invoice) =>
    buildFinanceReceiptPayload(invoice, branding.madrasaName),
  );
  const title = invoices.length > 1 ? t("finance.printReceipts") : t("finance.printReceipt");

  const handlePrint = () => {
    const printed = printTemplateDocument({
      previewElement: printRef.current,
      template,
      windowTitle: title,
      language,
      isRtl,
    });
    if (!printed) notify.error(t("templateEditor.exportFailed"));
  };

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
      {/* Offscreen 1:1 copy — the print source, without preview-only chrome. */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: -99999,
          left: -99999,
          pointerEvents: "none",
          zIndex: -9999,
        }}
      >
        <div ref={printRef} style={{ direction: isRtl ? "rtl" : "ltr" }}>
          {payloads.map((payload, index) => (
            <TemplateDocumentPreview
              key={`print-${invoices[index]?.id ?? index}`}
              template={template}
              data={payload}
              logoUrl={branding.logoUrl}
              isRtl={isRtl}
              showBoundary={false}
              breakAfter={index < payloads.length - 1}
            />
          ))}
        </div>
      </div>

      <div
        role="region"
        tabIndex={0}
        aria-label={title}
        className="mx-auto max-h-[70dvh] space-y-6 overflow-auto rounded-xl border border-dashed border-border bg-muted/20 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ direction: isRtl ? "rtl" : "ltr" }}
      >
        {payloads.map((payload, index) => (
          <div
            key={invoices[index]?.id ?? index}
            className="mx-auto"
            style={{ width: size.width, height: size.height }}
          >
            <TemplateDocumentPreview
              template={template}
              data={payload}
              logoUrl={branding.logoUrl}
              isRtl={isRtl}
              showBoundary
            />
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default InvoiceReceiptModal;
