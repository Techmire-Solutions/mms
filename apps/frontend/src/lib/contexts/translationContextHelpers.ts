import { registerLanguagePack, APP_TRANSLATIONS_EN } from "@mms/shared";
import { isEntryPath } from "@/lib/config/routes";
import { shouldForcePlatformEnglish } from "@/platform/lib/themeScope";

/**
 * Keys already reported as missing, so a key rendered in a loop warns once
 * rather than on every render.
 */
const reportedMissingKeys = new Set<string>();

/**
 * Dev-only guard against a key that exists in the type union but not in the
 * English pack at runtime — `translateApp` silently falls back to returning the
 * raw key, which ships as literal `students.idCard.title` text in the UI.
 */
export function warnIfKeyMissingAtRuntime(key: string): void {
  if (!import.meta.env.DEV) return;
  if (key in APP_TRANSLATIONS_EN) return;
  if (reportedMissingKeys.has(key)) return;
  reportedMissingKeys.add(key);
  console.warn(
    `[i18n] Missing translation key "${key}" — add it to APP_TRANSLATIONS_EN (packages/shared/src/appTranslationsEn.ts).`,
  );
}

export interface ResolveUiLanguageOptions {
  isApex: boolean;
  workspaceLoading: boolean;
  workspace: { enabled?: boolean } | null;
  workspaceLookupFailed: boolean;
  pathname: string;
  settingsLanguage: string;
}

export function resolveUiLanguage(options: ResolveUiLanguageOptions): string {
  if (
    shouldForcePlatformEnglish({
      isApex: options.isApex,
      workspaceLoading: options.workspaceLoading,
      workspace: options.workspace,
      workspaceLookupFailed: options.workspaceLookupFailed,
    })
  ) {
    // Platform apex + platform status screens: English/LTR only (mms-settings-i18n §5).
    return "en";
  }
  // Tenant auth entry (login / 2FA / forgot) stays English before workspace language applies.
  if (isEntryPath(options.pathname, { isApex: false })) {
    return "en";
  }
  return options.settingsLanguage;
}

export async function fetchLanguagePack(language: string): Promise<void> {
  if (language === "ar") {
    const translationModule = await import("@mms/shared/translations/ar");
    registerLanguagePack("ar", translationModule.APP_TRANSLATIONS_AR);
  } else if (language === "ur") {
    const translationModule = await import("@mms/shared/translations/ur");
    registerLanguagePack("ur", translationModule.APP_TRANSLATIONS_UR);
  } else if (language === "fa") {
    // The Persian pack covers every English key (asserted by
    // `appTranslations.test.ts`), so it no longer pulls the 0.64 MB Arabic chunk
    // in just to merge a fallback that never fires. That merge made Persian the
    // heaviest first paint of the four locales (2026-10-31 review, UX-13).
    const faModule = await import("@mms/shared/translations/fa");
    registerLanguagePack("fa", faModule.APP_TRANSLATIONS_FA);
  }
}
