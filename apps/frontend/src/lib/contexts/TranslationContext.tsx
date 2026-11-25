import React, { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useHydrateGlobalSettings } from "@/tenant/hooks/useHydrateGlobalSettings";
import { useHydrateBranding } from "@/tenant/hooks/useHydrateBranding";
import { useLocation } from "react-router-dom";
import { useTenant } from "@/lib/contexts/TenantContext";
import {
  getPlatformBrandingState,
  subscribePlatformBranding,
} from "@/lib/branding/platformBrandingStore";
import {
  translateAppParams,
  getLanguageDirection,
  isRtlLanguage,
  type AppTranslationKey,
  type TranslationArgs,
  type AppLanguageCode,
} from "@mms/contracts";
import { applyDocumentLanguage } from "@/lib/documentLanguage";
import { ensureLocaleFontsLoaded } from "@/lib/localeFonts";
import { reportClientError } from "@/lib/clientErrorReporting";
import {
  warnIfKeyMissingAtRuntime,
  resolveUiLanguage,
  fetchLanguagePack,
} from "@/lib/contexts/translationContextHelpers";

export type { TranslationFunction } from "@mms/fe-core/i18n";
export { TranslationContext } from "@mms/fe-core/i18n";
import {
  TranslationProvider as FeTranslationProvider,
  type TranslationContextValue,
} from "@mms/fe-core/i18n";

/** Languages whose packs are loaded on demand (see `fetchLanguagePack`). */
function isPackLanguage(language: string): boolean {
  return language === "ar" || language === "ur" || language === "fa";
}

export function TranslationProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { isHydrating } = useHydrateGlobalSettings();
  // Boot-time institution branding hydration for branding writers (fails open).
  useHydrateBranding();
  const settings = useGlobalSettings();
  const { pathname } = useLocation();
  const { isApex, workspace, workspaceLoading, workspaceLookupFailed } = useTenant();

  const language = resolveUiLanguage({
    isApex,
    workspaceLoading,
    workspace,
    workspaceLookupFailed,
    pathname,
    settingsLanguage: settings.language,
  });
  const [loadedLanguages, setLoadedLanguages] = useState<Record<string, boolean>>({ en: true });
  const isLanguageLoaded = !!loadedLanguages[language];
  const hasLoadedAnyLanguage = Object.values(loadedLanguages).some(Boolean);
  const [activeLanguage, setActiveLanguage] = useState<AppLanguageCode>("en");
  const [isLoading, setIsLoading] = useState(() => !isLanguageLoaded && isPackLanguage(language));

  // Follow the resolved UI language: adopt a loaded pack immediately, otherwise flag
  // the pending download. Adjusted during render (React's documented prop-change
  // pattern) instead of synchronously inside the fetch effect below, so no frame
  // renders text in the previous language while the effect catches up.
  const [languageAnchor, setLanguageAnchor] = useState({ language, isLanguageLoaded });
  if (
    languageAnchor.language !== language ||
    languageAnchor.isLanguageLoaded !== isLanguageLoaded
  ) {
    setLanguageAnchor({ language, isLanguageLoaded });
    if (isLanguageLoaded) {
      setActiveLanguage(language as AppLanguageCode);
    } else if (isPackLanguage(language)) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isLanguageLoaded || !isPackLanguage(language)) return;

    let active = true;

    fetchLanguagePack(language)
      .then(() => {
        if (!active) return;
        setLoadedLanguages((currentLoadedLanguages) => ({
          ...currentLoadedLanguages,
          [language]: true,
        }));
        setIsLoading(false);
      })
      .catch((translationError) => {
        if (!active) return;
        reportClientError(translationError, { context: "i18n.loadLanguage", language });
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [language, isLanguageLoaded]);

  useEffect(() => {
    applyDocumentLanguage(activeLanguage);
    ensureLocaleFontsLoaded(activeLanguage);
  }, [activeLanguage]);

  // White-label product/console names on the apex only; tenant hosts keep their
  // own institution branding and platform translation copy.
  const platformBranding = useSyncExternalStore(
    subscribePlatformBranding,
    getPlatformBrandingState,
    getPlatformBrandingState,
  );
  const platformProductName = isApex ? platformBranding.branding.productName.trim() : "";
  const platformConsoleTitle = isApex ? platformBranding.branding.consoleTitle.trim() : "";

  // Stable identity per active language so `useTranslation` consumers don't
  // re-render on every provider render (navigation, settings events, tenant churn).
  const t = useCallback(
    <K extends AppTranslationKey>(key: K, ...args: TranslationArgs<K>): string => {
      warnIfKeyMissingAtRuntime(key);
      if (key === "entry.productName" && platformProductName) return platformProductName;
      if (key === "platform.consoleTitle" && platformConsoleTitle) return platformConsoleTitle;
      return translateAppParams(key, activeLanguage, ...args);
    },
    [activeLanguage, platformProductName, platformConsoleTitle],
  );

  const dir = getLanguageDirection(activeLanguage);
  const isRtl = isRtlLanguage(activeLanguage);

  const value = useMemo<TranslationContextValue>(
    () => ({ language: activeLanguage, t, isLoading, dir, isRtl }),
    [activeLanguage, t, isLoading, dir, isRtl],
  );

  if (isHydrating || (!isLanguageLoaded && !hasLoadedAnyLanguage)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-muted/30" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            {translateAppParams("common.loading", "en")}
          </p>
        </div>
      </div>
    );
  }

  return <FeTranslationProvider value={value}>{children}</FeTranslationProvider>;
}
