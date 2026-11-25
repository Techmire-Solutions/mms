import { configurePrintBrandingResolver } from "@mms/fe-core/print/printBrandingTokens";
import { getBrandingChartPalette } from "@/lib/ui/brandingChartPalette";
import { getScopedBrandingSettings } from "@/lib/settingsPreviewStore";

/**
 * Gives shared print surfaces (document templates, invoices, certificates) the
 * institution branding and chart palette owned by the app settings store.
 */
configurePrintBrandingResolver(() => {
  const branding = getScopedBrandingSettings();
  const palette = getBrandingChartPalette();
  return {
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    destructive: palette.charts[0],
  };
});
