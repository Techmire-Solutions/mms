import { getAccountingHost } from "../host.js";
import type { BrandingChartPaletteHex } from "@mms/contracts";

export function useBrandPalette(): BrandingChartPaletteHex {
  return getAccountingHost().useBrandPalette();
}
