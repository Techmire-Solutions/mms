import { useCallback, useEffect, useState } from "react";
import type { ThemeMode } from "@mms/shared";
import { applyDocumentTheme } from "@/lib/brandingThemeCore";
import { applyApexPlatformTheme } from "@/lib/branding/apexPlatformTheme";
import {
  MMS_PLATFORM_BRANDING,
  MMS_PLATFORM_GLOBAL_SETTINGS,
} from "@/lib/branding/platformThemeConfig";
import { useSystemThemeListener } from "@/hooks/useSystemThemeListener";

export function usePlatformThemePreview() {
  const [selectedMode, setSelectedMode] = useState<ThemeMode>(MMS_PLATFORM_GLOBAL_SETTINGS.theme);

  const apply = useCallback(() => {
    applyDocumentTheme(MMS_PLATFORM_BRANDING, selectedMode, "en");
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
