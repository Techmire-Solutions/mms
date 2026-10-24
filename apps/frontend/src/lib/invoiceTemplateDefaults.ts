import { mergeBrandingSettings } from "@mms/shared";
import { getInvoiceTemplateBranding } from "./invoiceTemplateBranding";
import { buildDefaultInvoiceTemplateElements } from "./invoiceTemplateElements";
import type { BrandingInfo, InvoiceTemplate, TemplateTranslate } from "./invoiceTemplateTypes";

/**
 * Generates the default invoice template schema for A6 size canvas.
 *
 * `branding` is optional so non-React callers (store snapshot/SSR) keep working,
 * while the editor can pass the same reactive branding it renders with — a
 * single branding source instead of the non-reactive document store.
 */
export function getDefaultTemplate(
  branding?: BrandingInfo,
  translate?: TemplateTranslate,
): InvoiceTemplate {
  // Normalize partial branding (e.g. a preview/mock object) so every builder
  // receives a complete BrandingInfo and never emits `undefined` labels.
  const b = branding ? mergeBrandingSettings(branding) : getInvoiceTemplateBranding();
  return {
    pageSize: "A6",
    elements: buildDefaultInvoiceTemplateElements(b, translate),
  };
}
