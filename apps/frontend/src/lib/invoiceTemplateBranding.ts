import { DEFAULT_BRANDING_SETTINGS, mergeBrandingSettings } from "@mms/shared";
import { getObject } from "@/lib/db";
import type { BrandingInfo } from "./invoiceTemplateTypes";

/**
 * Retrieves the institution's branding settings, falling back to defaults if not found.
 */
export function getInvoiceTemplateBranding(): BrandingInfo {
  const b = getObject<BrandingInfo | null>("branding", null);
  if (b) return mergeBrandingSettings(b);
  try {
    const raw = localStorage.getItem("madrasa_branding");
    if (raw) {
      const parsed = JSON.parse(raw) as BrandingInfo;
      localStorage.setItem("mms_branding", raw);
      try {
        localStorage.removeItem("madrasa_branding");
      } catch {
        // Ignore removal error
      }
      return mergeBrandingSettings(parsed);
    }
  } catch {
    // Ignore read error
  }
  return DEFAULT_BRANDING_SETTINGS;
}
