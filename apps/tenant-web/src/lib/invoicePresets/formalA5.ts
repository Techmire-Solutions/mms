import {
  defaultTemplateTranslate,
  type BrandingInfo,
  type InvoiceTemplate,
  type TemplateTranslate,
} from "@/lib/invoiceTemplateTypes";
import { presetPalette } from "./palette";
import { buildFormalA5AmountElements } from "./formalA5AmountElements";
import { buildFormalA5HeaderElements } from "./formalA5HeaderElements";

/**
 * Builds the Formal A5 official certificate/letterhead preset.
 */
export function buildFormalA5Preset(
  b: BrandingInfo,
  translate: TemplateTranslate = defaultTemplateTranslate,
): InvoiceTemplate {
  const palette = presetPalette(b, translate);

  return {
    pageSize: "A5",
    elements: [...buildFormalA5HeaderElements(b, palette), ...buildFormalA5AmountElements(palette)],
  };
}
