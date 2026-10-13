import React, { createContext, useState, useEffect, useCallback, useMemo } from "react";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useLocation } from "react-router-dom";
import { useTenant } from "@/lib/contexts/TenantContext";
import {
  translateAppParams,
  getLanguageDirection,
  isRtlLanguage,
  type AppTranslationKey,
  type TranslationArgs,
  type AppLanguageCode,
} from "@mms/shared";
import { applyDocumentLanguage } from "@/lib/documentLanguage";
import { ensureLocaleFontsLoaded } from "@/lib/localeFonts";
import { reportClientError } from "@/lib/clientErrorReporting";
import {
  warnIfKeyMissingAtRuntime,
  resolveUiLanguage,
  fetchLanguagePack,
} from "@/lib/contexts/translationContextHelpers";

export type TranslationFunction = <K extends AppTranslationKey>(
  key: K,
  ...args: TranslationArgs<K>
) => string;

interface TranslationContextType {
  language: string;
  t: TranslationFunction;
  isLoading: boolean;
  dir: "ltr" | "rtl";
  isRtl: boolean;
}

export const TranslationContext = createContext<TranslationContextType | null>(null);

export function TranslationProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
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
  const [activeLanguage, setActiveLanguage] = useState<AppLanguageCode>("en");
  const [isLoading, setIsLoading] = useState(false);

  const isLanguageLoaded = !!loadedLanguages[language];
  const hasLoadedAnyLanguage = Object.values(loadedLanguages).some(Boolean);

  useEffect(() => {
    if (isLanguageLoaded) {
      setActiveLanguage(language as AppLanguageCode);
      return;
    }

    let active = true;
    setIsLoading(true);

    if (language !== "ar" && language !== "ur" && language !== "fa") {
      setIsLoading(false);
      return;
    }

    fetchLanguagePack(language)
      .then(() => {
        if (!active) return;
        setLoadedLanguages((currentLoadedLanguages) => ({
          ...currentLoadedLanguages,
          [language]: true,
        }));
        setActiveLanguage(language as AppLanguageCode);
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

  // Stable identity per active language so `useTranslation` consumers don't
  // re-render on every provider render (navigation, settings events, tenant churn).
  const t = useCallback(
    <K extends AppTranslationKey>(key: K, ...args: TranslationArgs<K>): string => {
      warnIfKeyMissingAtRuntime(key);
      return translateAppParams(key, activeLanguage, ...args);
    },
    [activeLanguage],
  );

  const dir = getLanguageDirection(activeLanguage);
  const isRtl = isRtlLanguage(activeLanguage);

  const value = useMemo<TranslationContextType>(
    () => ({ language: activeLanguage, t, isLoading, dir, isRtl }),
    [activeLanguage, t, isLoading, dir, isRtl],
  );

  if (!isLanguageLoaded && !hasLoadedAnyLanguage) {
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

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}
