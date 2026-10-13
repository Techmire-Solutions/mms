import { useCallback, useSyncExternalStore } from "react";
import { INVOICE_TEMPLATE_OBJECT_KEY } from "@mms/shared";
import {
  loadTemplate,
  saveTemplate,
  resetTemplate,
  INVOICE_TEMPLATE_CHANGED_EVENT,
} from "./invoiceTemplatePersistence";
import { getDefaultTemplate } from "./invoiceTemplateDefaults";
import { getAvailablePresets } from "./invoiceTemplatePresets";
import type { InvoiceTemplate } from "./invoiceTemplateTypes";

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
  loadTemplate,
  saveTemplate,
  resetTemplate,
  AVAILABLE_FIELDS,
  resolveField,
  indexLookups,
  type IndexedFieldLookups,
  INVOICE_TEMPLATE_CHANGED_EVENT,
  invoiceTemplateDocumentStore,
  type InvoiceTemplateFieldKey,
} from "./invoiceTemplatePersistence";
export { getAvailablePresets, type InvoiceTemplatePreset } from "./invoiceTemplatePresets";
export { generateQrSvgUri, generateQrMatrix } from "./qrCodeGenerator";

export interface UseInvoiceTemplateReturn {
  template: InvoiceTemplate;
  saveTemplate: (tmpl: InvoiceTemplate) => void;
  resetTemplate: () => InvoiceTemplate;
  applyPreset: (presetKey: string) => InvoiceTemplate | null;
}

let cachedTemplate: InvoiceTemplate | null = null;
let defaultTemplateSnapshot: InvoiceTemplate | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function handleWindowUpdate(e?: Event): void {
  if (
    e instanceof CustomEvent &&
    e.detail &&
    typeof e.detail === "object" &&
    Array.isArray(e.detail.elements)
  ) {
    cachedTemplate = e.detail as InvoiceTemplate;
  } else {
    cachedTemplate = loadTemplate();
  }
  notifyListeners();
}

function handleStorage(e: StorageEvent): void {
  if (e.key === INVOICE_TEMPLATE_OBJECT_KEY) {
    cachedTemplate = loadTemplate();
    notifyListeners();
  }
}

function setupGlobalListeners(): void {
  if (typeof window !== "undefined") {
    window.addEventListener(INVOICE_TEMPLATE_CHANGED_EVENT, handleWindowUpdate);
    window.addEventListener("storage", handleStorage);
  }
}

function teardownGlobalListeners(): void {
  if (typeof window !== "undefined") {
    window.removeEventListener(INVOICE_TEMPLATE_CHANGED_EVENT, handleWindowUpdate);
    window.removeEventListener("storage", handleStorage);
  }
}

function getTemplateSnapshot(): InvoiceTemplate {
  if (!cachedTemplate) {
    cachedTemplate = loadTemplate();
  }
  return cachedTemplate;
}

function getDefaultTemplateSnapshot(): InvoiceTemplate {
  if (!defaultTemplateSnapshot) {
    defaultTemplateSnapshot = getDefaultTemplate();
  }
  return defaultTemplateSnapshot;
}

function subscribeTemplate(callback: () => void): () => void {
  if (listeners.size === 0) {
    setupGlobalListeners();
  }
  listeners.add(callback);

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      teardownGlobalListeners();
    }
  };
}

/**
 * Reactive React hook for invoice template state using React's useSyncExternalStore.
 * Guarantees tear-free synchronization across modals, preview components, and browser tabs.
 */
export function useInvoiceTemplate(): UseInvoiceTemplateReturn {
  const template = useSyncExternalStore(
    subscribeTemplate,
    getTemplateSnapshot,
    getDefaultTemplateSnapshot,
  );

  const handleSave = useCallback((tmpl: InvoiceTemplate) => {
    cachedTemplate = tmpl;
    saveTemplate(tmpl);
  }, []);

  const handleReset = useCallback(() => {
    const restored = resetTemplate();
    cachedTemplate = restored;
    return restored;
  }, []);

  const handleApplyPreset = useCallback(
    (presetKey: string): InvoiceTemplate | null => {
      const presets = getAvailablePresets();
      const found = presets.find((p) => p.key === presetKey);
      if (found) {
        handleSave(found.template);
        return found.template;
      }
      return null;
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
