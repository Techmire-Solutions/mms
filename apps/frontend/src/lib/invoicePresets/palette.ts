import { PRINT_NEUTRAL } from "@/lib/ui/printBrandingTokens";
import {
  INVOICE_TEMPLATE_STATIC_KEY_PREFIX,
  type BrandingInfo,
  type TemplateTranslate,
} from "@/lib/invoiceTemplateTypes";

/** Resolved print colours + namespace-bound translator shared by the preset builders. */
export interface InvoicePresetPalette {
  primary: string;
  text: string;
  border: string;
  label: string;
  muted: string;
  tr: (key: string) => string;
}

export function presetPalette(b: BrandingInfo, translate: TemplateTranslate): InvoicePresetPalette {
  return {
    primary: b.primaryColor,
    text: PRINT_NEUTRAL.text,
    border: PRINT_NEUTRAL.border,
    label: PRINT_NEUTRAL.label,
    muted: PRINT_NEUTRAL.muted,
    tr: (key: string) => translate(`${INVOICE_TEMPLATE_STATIC_KEY_PREFIX}${key}`),
  };
}
