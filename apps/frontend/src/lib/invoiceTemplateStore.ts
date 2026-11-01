/**
 * @file invoiceTemplateStore.ts
 * @description Invoice template facade: types, defaults, presets, field resolution,
 * and the server-backed `useInvoiceTemplate` hook.
 *
 * Layouts live in `/api/templates/:key` (see `lib/templates/useDocumentTemplates`).
 * This module no longer owns localStorage persistence or a custom event bus — the
 * TanStack Query cache and the realtime invalidation cover both.
 */

import { useCallback, useMemo } from "react";
import { INVOICE_TEMPLATE_OBJECT_KEY } from "@mms/shared";
import {
  useDocumentTemplate,
  useResetDocumentTemplate,
  useSaveDocumentTemplate,
} from "@/lib/templates/useDocumentTemplates";
import { getDefaultTemplate } from "./invoiceTemplateDefaults";
import { getAvailablePresets } from "./invoiceTemplatePresets";
import type { InvoiceReceiptPayload, InvoiceTemplate } from "./invoiceTemplateTypes";

/** Invoice print template types, defaults, and field resolution. */
export type {
  PageSizeInfo,
  PageSizeKey,
  ElementStyle,
  TemplateElement,
  TemplateElementType,
  InvoiceTemplate,
  TemplateOrientation,
  TemplateTableColumn,
  TemplateTableConfig,
  BrandingInfo,
  LookupItem,
  FieldLookupInfo,
  InvoiceReceiptPayload,
  StandardInvoiceField,
} from "./invoiceTemplateTypes";
export {
  PAGE_SIZES,
  getPageDimensions,
  INVOICE_TEMPLATE_FIELD_KEY_PREFIX,
  INVOICE_TEMPLATE_STATIC_KEY_PREFIX,
  type TemplateTranslate,
} from "./invoiceTemplateTypes";
export { getDefaultTemplate } from "./invoiceTemplateDefaults";
export { getInvoiceTemplateBranding } from "./invoiceTemplateBranding";
export {
  AVAILABLE_FIELDS,
  resolveField,
  indexLookups,
  type IndexedFieldLookups,
} from "./invoiceTemplateFields";
export type { InvoiceTemplateFieldKey } from "./invoiceTemplateTypes";
export { getAvailablePresets, type InvoiceTemplatePreset } from "./invoiceTemplatePresets";
export { generateQrSvgUri, generateQrMatrix } from "./qrCodeGenerator";

/** Server-side key for the obligations invoice layout. */
export const INVOICE_TEMPLATE_KEY = INVOICE_TEMPLATE_OBJECT_KEY;

export interface UseInvoiceTemplateReturn {
  template: InvoiceTemplate;
  saveTemplate: (tmpl: InvoiceTemplate) => void;
  resetTemplate: () => InvoiceTemplate;
  applyPreset: (presetKey: string) => InvoiceTemplate | null;
}

/**
 * Server-backed invoice layout for previews and print modals.
 *
 * The query is seeded from the tenant cache (or the factory layout), so a print
 * preview renders on the first paint and updates when the server copy arrives.
 */
export function useInvoiceTemplate(): UseInvoiceTemplateReturn {
  const fallback = useMemo(() => getDefaultTemplate(), []);
  const { template } = useDocumentTemplate<InvoiceReceiptPayload>(INVOICE_TEMPLATE_KEY, fallback);
  const { mutateAsync: saveMutation } =
    useSaveDocumentTemplate<InvoiceReceiptPayload>(INVOICE_TEMPLATE_KEY);
  const { mutateAsync: resetMutation } = useResetDocumentTemplate(INVOICE_TEMPLATE_KEY);

  const handleSave = useCallback(
    (tmpl: InvoiceTemplate) => {
      void saveMutation(tmpl);
    },
    [saveMutation],
  );

  const handleReset = useCallback((): InvoiceTemplate => {
    void resetMutation();
    return getDefaultTemplate();
  }, [resetMutation]);

  const handleApplyPreset = useCallback(
    (presetKey: string): InvoiceTemplate | null => {
      const found = getAvailablePresets().find((preset) => preset.key === presetKey);
      if (!found) return null;
      handleSave(found.template);
      return found.template;
    },
    [handleSave],
  );

  return {
    template,
    saveTemplate: handleSave,
    resetTemplate: handleReset,
    applyPreset: handleApplyPreset,
  };
}
