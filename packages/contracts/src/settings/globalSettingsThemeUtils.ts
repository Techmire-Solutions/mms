import type { AppTranslationKey } from "../i18n/appTranslations.js";
import { translateApp, translateAppParams } from "../i18n/appTranslations.js";
import type { GlobalSettings } from "./globalSettingsTypes.js";

export type ThemeMode = GlobalSettings["theme"];

export const THEME_MODE_VALUES = ["light", "dark", "system"] as const;

/** Display mode options for global settings theme picker. */
export const THEME_MODE_OPTIONS: readonly {
  value: ThemeMode;
  labelKey: AppTranslationKey;
}[] = [
  { value: "light", labelKey: "global.themeLight" },
  { value: "dark", labelKey: "global.themeDark" },
  { value: "system", labelKey: "global.themeSystem" },
] as const;

/** Coerces stored theme mode to a supported value. */
export function normalizeThemeMode(value: string | undefined): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

/** Resolves light/dark chrome from stored theme mode and OS preference. */
export function resolveBrandingThemeMode(
  theme: ThemeMode,
  systemPrefersDark: boolean,
): "light" | "dark" {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

/** Human-readable display-mode label for settings summary chips (incl. system resolve). */
export function formatThemeDisplayModeSummary(
  displayMode: ThemeMode,
  previewMode: "light" | "dark",
  language: string,
): string {
  if (displayMode === "system") {
    const resolved = translateApp(
      previewMode === "dark" ? "global.themeDark" : "global.themeLight",
      language,
    );
    return translateAppParams("theme.displayModeSystemResolved", language, { resolved });
  }
  const labelKey =
    THEME_MODE_OPTIONS.find((opt) => opt.value === displayMode)?.labelKey ?? "global.themeSystem";
  return translateApp(labelKey, language);
}
