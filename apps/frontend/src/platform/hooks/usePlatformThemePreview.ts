import { useEffect, useState } from "react";
import type { ThemeMode } from "@mms/shared";
import { applyDocumentTheme } from "@/lib/brandingThemeCore";
import { applyApexPlatformTheme } from "@/lib/branding/apexPlatformTheme";
import { MMS_PLATFORM_BRANDING, MMS_PLATFORM_GLOBAL_SETTINGS } from "@/platform/lib/themeScope";

export function usePlatformThemePreview() {
  const [selectedMode, setSelectedMode] = useState<ThemeMode>(MMS_PLATFORM_GLOBAL_SETTINGS.theme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => applyDocumentTheme(MMS_PLATFORM_BRANDING, selectedMode, "en");
    apply();
    if (selectedMode === "system") media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      applyApexPlatformTheme();
    };
  }, [selectedMode]);

  return { selectedMode, setSelectedMode };
}
