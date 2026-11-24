import { useCallback, useEffect, useState } from "react";
import type { ThemeMode } from "@mms/contracts";
import { applyDocumentTheme } from "@/lib/brandingThemeCore";
import { applyApexPlatformTheme } from "@/lib/branding/apexPlatformTheme";
import {
  getEffectivePlatformThemeMode,
  getPlatformBrandingAsBrandingSettings,
} from "@/lib/branding/platformBrandingStore";
import { useSystemThemeListener } from "@/hooks/useSystemThemeListener";

/** Unsaved display-mode preview for the platform Theme tab. */
export function usePlatformThemePreview() {
  const [selectedMode, setSelectedMode] = useState<ThemeMode>(getEffectivePlatformThemeMode());

  const apply = useCallback(() => {
    applyDocumentTheme(getPlatformBrandingAsBrandingSettings(), selectedMode, "en");
  }, [selectedMode]);

  useSystemThemeListener(() => {
    if (selectedMode === "system") apply();
  });

  useEffect(() => {
    apply();
    return () => {
      applyApexPlatformTheme();
    };
  }, [apply]);

  return { selectedMode, setSelectedMode };
}
