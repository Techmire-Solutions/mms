import {
  defaultTemplateTranslate,
  type BrandingInfo,
  type InvoiceTemplate,
  type TemplateTranslate,
} from "@/lib/invoiceTemplateTypes";
import { buildDefaultInvoiceTemplateElements } from "@/lib/invoiceTemplateElements";

/**
 * Builds the Classic A6 preset (MMS default).
 */
export function buildClassicPreset(
  b: BrandingInfo,
  translate: TemplateTranslate = defaultTemplateTranslate,
): InvoiceTemplate {
  return {
    pageSize: "A6",
    elements: buildDefaultInvoiceTemplateElements(b, translate),
  };
}
