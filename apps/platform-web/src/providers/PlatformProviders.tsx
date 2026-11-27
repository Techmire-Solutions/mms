import React, { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { translateAppParams, type AppTranslationKey, type TranslationArgs } from "@mms/contracts";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import {
  TranslationProvider as FeTranslationProvider,
  useTranslation,
  type TranslationContextValue,
} from "@mms/fe-core/i18n";
import { applyDocumentLanguage } from "@mms/fe-core/i18n/documentLanguage";
import { ensureLocaleFontsLoaded } from "@mms/fe-core/i18n/localeFonts";
import { warnIfKeyMissingAtRuntime } from "@mms/fe-core/i18n/translationContextHelpers";
import {
  getPlatformBrandingState,
  subscribePlatformBranding,
} from "@mms/fe-core/lib/platformBrandingStore";
import { queryClientInstance } from "@mms/fe-core/query/queryClient";
import { Button, UiConfigProvider } from "@mms/ui";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { TenantProvider } from "@/lib/contexts/TenantContext";

const LazyToaster = React.lazy(() => import("@mms/ui").then((m) => ({ default: m.Toaster })));

function PlatformTranslationBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  const platformBranding = useSyncExternalStore(
    subscribePlatformBranding,
    getPlatformBrandingState,
    getPlatformBrandingState,
  );
  const productName = platformBranding.branding.productName.trim();
  const consoleTitle = platformBranding.branding.consoleTitle.trim();

  useEffect(() => {
    applyDocumentLanguage("en");
    ensureLocaleFontsLoaded("en");
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("dir", "ltr");
      document.documentElement.setAttribute("lang", "en");
    }
  }, []);

  const t = useCallback(
    <K extends AppTranslationKey>(key: K, ...args: TranslationArgs<K>): string => {
      warnIfKeyMissingAtRuntime(key);
      if (key === "entry.productName" && productName) return productName;
      if (key === "platform.consoleTitle" && consoleTitle) return consoleTitle;
      return translateAppParams(key, "en", ...args);
    },
    [productName, consoleTitle],
  );

  const value = useMemo<TranslationContextValue>(
    () => ({ language: "en", t, isLoading: false, dir: "ltr", isRtl: false }),
    [t],
  );

  return <FeTranslationProvider value={value}>{children}</FeTranslationProvider>;
}

function PlatformUiConfigBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <UiConfigProvider
      config={{
        dir: "ltr",
        language: "en",
        translate: t as unknown as (key: string) => string,
        labels: {
          cancel: t("common.cancel"),
          confirm: t("common.confirm"),
          delete: t("common.delete"),
          close: t("common.close"),
          retry: t("common.retry"),
          searchPlaceholder: t("common.searchPlaceholder"),
          clearSearch: t("common.clearSearch"),
          loading: t("common.loading"),
        },
      }}
    >
      {children}
    </UiConfigProvider>
  );
}

/**
 * Apex Platform Console root provider composition (Auth, QueryClient, Router,
 * Tenant host detection, English i18n, and shared @mms/ui configuration).
 */
export function PlatformProviders({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="max-w-md space-y-4 text-center">
            <h2 className="text-xl font-bold text-foreground">
              {translateAppParams("errors.boundary.title", "en")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {translateAppParams("errors.boundary.description", "en")}
            </p>
            <Button onClick={() => window.location.reload()}>
              {translateAppParams("common.retry", "en")}
            </Button>
          </div>
        </div>
      }
    >
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <TenantProvider>
              <PlatformTranslationBridge>
                <PlatformUiConfigBridge>{children}</PlatformUiConfigBridge>
              </PlatformTranslationBridge>
            </TenantProvider>
          </Router>
          <React.Suspense fallback={null}>
            <LazyToaster />
          </React.Suspense>
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
