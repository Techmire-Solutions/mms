import { mergeBrandingSettings } from "@mms/shared";
import {
  defaultTemplateTranslate,
  type BrandingInfo,
  type TemplateTranslate,
} from "@/lib/invoiceTemplateTypes";
import { getInvoiceTemplateBranding } from "@/lib/invoiceTemplateBranding";
import { buildClassicPreset } from "./classic";
import { buildFormalA5Preset } from "./formalA5";
import { buildModernPreset } from "./modern";
import { buildThermalPreset } from "./thermal";
import type { InvoiceTemplatePreset } from "./types";

/**
 * Returns available template presets for obligations receipts.
 */
export function getAvailablePresets(
  branding?: BrandingInfo,
  translate: TemplateTranslate = defaultTemplateTranslate,
): InvoiceTemplatePreset[] {
  const b = branding ? mergeBrandingSettings(branding) : getInvoiceTemplateBranding();
  return [
    {
      key: "classic_a6",
      nameKey: "obligations.invoiceTemplate.presetClassic",
      template: buildClassicPreset(b, translate),
    },
    {
      key: "thermal_80mm",
      nameKey: "obligations.invoiceTemplate.presetThermal",
      template: buildThermalPreset(b, translate),
    },
    {
      key: "formal_a5",
      nameKey: "obligations.invoiceTemplate.presetFormal",
      template: buildFormalA5Preset(b, translate),
    },
    {
      key: "modern_a6",
      nameKey: "obligations.invoiceTemplate.presetModern",
      template: buildModernPreset(b, translate),
    },
  ];
}
