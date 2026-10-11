import React, { createContext, useContext, useEffect, useState } from "react";
import type { BrandingChartPaletteHex } from "@mms/shared";
import { SETTINGS_PREVIEW_EVENT } from "@/lib/settingsPreview";
import { getBrandingChartPalette } from "@/lib/brandingChartPalette";

const BrandingPaletteContext = createContext<BrandingChartPaletteHex | null>(null);

/**
 * Provides institution-derived chart colours; refreshes on save, preview, and theme changes.
 */
export function BrandingPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [palette, setPalette] = useState<BrandingChartPaletteHex>(() => getBrandingChartPalette());

  useEffect(() => {
    const refresh = (): void => setPalette(getBrandingChartPalette());
    window.addEventListener("local-database-update", refresh);
    window.addEventListener(SETTINGS_PREVIEW_EVENT, refresh);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", refresh);
    return () => {
      window.removeEventListener("local-database-update", refresh);
      window.removeEventListener(SETTINGS_PREVIEW_EVENT, refresh);
      media.removeEventListener("change", refresh);
    };
  }, []);

  return (
    <BrandingPaletteContext.Provider value={palette}>{children}</BrandingPaletteContext.Provider>
  );
}

/** Institution brand palette for Recharts and inline chart styles. */
export function useBrandPalette(): BrandingChartPaletteHex {
  const brandingPalette = useContext(BrandingPaletteContext);
  if (!brandingPalette) {
    return getBrandingChartPalette();
  }
  return brandingPalette;
}
