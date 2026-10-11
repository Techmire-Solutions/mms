import { useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  mapToTypstFeeReceipt,
  mapToZohoInvoice,
} from "@/components/ui/template-editor/templatePayloadMappers";
import type { ZohoInvoicePayload } from "@mms/shared";

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "document";
}

function triggerFileDownload(
  filename: string,
  content: string,
  mimeType = "application/json",
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useInvoiceTemplateExports() {
  const { t } = useTranslation();

  const handleExportTypst = useCallback(
    (payload: Record<string, unknown>) => {
      try {
        const conforming = mapToTypstFeeReceipt(payload);
        const jsonStr = JSON.stringify(conforming, null, 2);
        triggerFileDownload(
          `typst-invoice-${safeFilenamePart(conforming.receiptNo)}.json`,
          jsonStr,
        );
        notify.success(t("templateEditor.typstExported"));
      } catch (err) {
        console.error("Typst export failed:", err);
        notify.error(t("templateEditor.exportFailed"));
      }
    },
    [t],
  );

  const handleExportZoho = useCallback(
    (zohoPayload: ZohoInvoicePayload) => {
      try {
        const conforming = mapToZohoInvoice({ ...zohoPayload });
        const jsonStr = JSON.stringify(conforming, null, 2);
        triggerFileDownload(
          `zoho-invoice-${safeFilenamePart(conforming.invoice_number)}.json`,
          jsonStr,
        );
        notify.success(t("templateEditor.zohoExported"));
      } catch (err) {
        console.error("Zoho export failed:", err);
        notify.error(t("templateEditor.exportFailed"));
      }
    },
    [t],
  );

  return {
    handleExportTypst,
    handleExportZoho,
  };
}
