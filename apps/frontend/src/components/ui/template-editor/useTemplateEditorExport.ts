/**
 * @file useTemplateEditorExport.ts
 * @description Print / Typst / Zoho actions for the editor toolbar.
 */

import { useCallback, useState } from "react";
import type { DocumentTemplate, ZohoInvoicePayload } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notify } from "@/lib/notify";
import { mapToZohoInvoice } from "./templatePayloadMappers";

export interface UseTemplateEditorExportOptions<TPayload = Record<string, unknown>> {
  template: DocumentTemplate<TPayload>;
  sampleData?: TPayload;
  onExportTypst?: (payload: TPayload) => void | Promise<void>;
  onExportZoho?: (payload: ZohoInvoicePayload) => void | Promise<void>;
  /** Overrides the browser print of the editing surface. */
  onPrint?: () => void;
  t: TranslationFunction;
}

export interface UseTemplateEditorExportReturn {
  isExporting: boolean;
  handlePrint: () => void;
  handleExportTypst: () => Promise<void>;
  handleExportZoho: () => Promise<void>;
}

/**
 * Extracted from the editor shell, which had grown past the repository's 300-line
 * ceiling. Behaviour is unchanged: both data exports send the *sample payload* through
 * the shared mappers, and printing falls back to the browser.
 */
export function useTemplateEditorExport<TPayload = Record<string, unknown>>({
  template,
  sampleData,
  onExportTypst,
  onExportZoho,
  onPrint,
  t,
}: UseTemplateEditorExportOptions<TPayload>): UseTemplateEditorExportReturn {
  const [isExporting, setIsExporting] = useState(false);

  const handlePrint = useCallback(() => {
    if (onPrint) {
      onPrint();
      return;
    }
    window.print();
  }, [onPrint]);

  const handleExportTypst = useCallback(async () => {
    if (!onExportTypst) return;
    setIsExporting(true);
    try {
      await onExportTypst((sampleData || {}) as TPayload);
    } catch (err) {
      console.error("Typst export failed:", err);
      notify.error(t("templateEditor.exportFailed"));
    } finally {
      setIsExporting(false);
    }
  }, [onExportTypst, sampleData, t]);

  const handleExportZoho = useCallback(async () => {
    if (!onExportZoho) return;
    setIsExporting(true);
    try {
      const zohoPayload = mapToZohoInvoice(
        (sampleData || {}) as Record<string, unknown>,
        template as DocumentTemplate,
      );
      await onExportZoho(zohoPayload);
    } catch (err) {
      console.error("Zoho export failed:", err);
      notify.error(t("templateEditor.exportFailed"));
    } finally {
      setIsExporting(false);
    }
  }, [onExportZoho, sampleData, t, template]);

  return { isExporting, handlePrint, handleExportTypst, handleExportZoho };
}
