import React from "react";
import { Printer, FileDown, Loader2 } from "lucide-react";
import { Button } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";

interface PrintInvoiceModalFooterProps {
  pageSize: string;
  width: number;
  height: number;
  isGeneratingPdf: boolean;
  onClose: () => void;
  onExportPDF: () => void;
  onPrint: () => void;
}

export function PrintInvoiceModalFooter({
  pageSize,
  width,
  height,
  isGeneratingPdf,
  onClose,
  onExportPDF,
  onPrint,
}: PrintInvoiceModalFooterProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="m-0 min-w-0 text-xs text-muted-foreground">
        {t("obligations.print.pageSize", {
          size: pageSize,
          width,
          height,
        })}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={onClose}
          variant="outline"
          className="min-h-11 px-4 py-2 h-auto rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors shadow-none"
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          onClick={onExportPDF}
          disabled={isGeneratingPdf}
          aria-busy={isGeneratingPdf}
          variant="outline"
          className="flex min-h-11 items-center gap-2 px-4 py-2 h-auto rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50 shadow-none"
        >
          {isGeneratingPdf ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />{" "}
              {t("obligations.invoiceTemplate.exportingPdf")}
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" aria-hidden="true" /> {t("reports.export.pdf")}
            </>
          )}
        </Button>
        <Button
          type="button"
          onClick={onPrint}
          className="flex min-h-11 items-center gap-2 px-5 py-2 h-auto rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <Printer className="w-4 h-4" aria-hidden="true" /> {t("reports.export.print")}
        </Button>
      </div>
    </div>
  );
}
