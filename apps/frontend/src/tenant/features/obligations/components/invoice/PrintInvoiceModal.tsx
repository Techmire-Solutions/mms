import React from "react";
import { Printer, Settings } from "lucide-react";
import type {
  ObligationCollection,
  ObligationType,
  MujtahidRep,
  Mujtahid,
} from "@/lib/data/obligationsData";
import { InvoicePrintPreview } from "@/tenant/features/obligations/components/invoice/InvoicePrintPreview";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { useTranslation } from "@/hooks/useTranslation";
import { usePrintInvoiceModalController } from "./usePrintInvoiceModalController";
import { PrintInvoiceModalFooter } from "./PrintInvoiceModalFooter";

export interface PrintInvoiceModalProps {
  collection: ObligationCollection;
  obligationTypes?: ObligationType[];
  reps?: MujtahidRep[];
  mujtahids?: Mujtahid[];
  onClose: () => void;
  onOpenEditor?: () => void;
}

export function PrintInvoiceModal({
  collection,
  obligationTypes = [],
  reps = [],
  mujtahids = [],
  onClose,
  onOpenEditor,
}: PrintInvoiceModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    template,
    size,
    isRtl,
    printRef,
    exportRef,
    lookups,
    isGeneratingPdf,
    handlePrint,
    handleExportPDF,
  } = usePrintInvoiceModalController({
    collection,
    obligationTypes,
    reps,
    mujtahids,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={t("obligations.print.title")}
      subtitle={t("obligations.print.receiptNo", { number: collection.receipt_no })}
      icon={Printer}
      size="lg"
      headerActions={
        onOpenEditor ? (
          <Button
            type="button"
            onClick={onOpenEditor}
            variant="outline"
            className="flex min-h-11 items-center gap-1.5 px-3 py-1.5 h-auto text-xs font-semibold rounded-lg border border-border hover:bg-muted transition-colors shadow-none"
          >
            <Settings className="w-3.5 h-3.5" aria-hidden="true" />{" "}
            {t("obligations.print.customizeTemplate")}
          </Button>
        ) : null
      }
      footer={
        <PrintInvoiceModalFooter
          pageSize={template.pageSize}
          width={size.width}
          height={size.height}
          isGeneratingPdf={isGeneratingPdf}
          onClose={onClose}
          onExportPDF={handleExportPDF}
          onPrint={handlePrint}
        />
      }
    >
      {/* Offscreen unscaled container for clean, high-fidelity PDF rasterization */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: -99999,
          left: -99999,
          width: size.width,
          height: size.height,
          zIndex: -9999,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          ref={exportRef}
          style={{
            width: size.width,
            height: size.height,
            backgroundColor: "white",
            position: "relative",
            lineHeight: 1.25,
            direction: isRtl ? "rtl" : "ltr",
          }}
        >
          <InvoicePrintPreview
            template={template}
            collection={collection}
            lookups={lookups}
            showBoundary={false}
            scale={1}
          />
        </div>
      </div>

      <div
        role="region"
        tabIndex={0}
        aria-label={t("obligations.print.preview")}
        className="flex min-h-preview-tall justify-center overflow-x-auto rounded-xl border border-dashed border-border bg-muted/20 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div
          className="origin-top scale-preview-sm sm:scale-preview-md md:scale-preview-lg lg:scale-preview-xl"
          style={{ direction: isRtl ? "rtl" : "ltr" }}
        >
          <div ref={printRef} style={{ lineHeight: 1.4, width: size.width, height: size.height }}>
            <InvoicePrintPreview
              template={template}
              collection={collection}
              lookups={lookups}
              showBoundary
              scale={1}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
