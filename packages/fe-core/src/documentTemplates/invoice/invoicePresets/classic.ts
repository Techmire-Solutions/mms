import {
  defaultTemplateTranslate,
  type BrandingInfo,
  type InvoiceTemplate,
  type TemplateTranslate,
} from "../invoiceTemplateTypes";
import { buildDefaultInvoiceTemplateElements } from "../invoiceTemplateElements";

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
