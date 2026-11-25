import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@mms/fe-core/auth/AuthContext";
import { BrandingPaletteProvider } from "@/lib/contexts/BrandingPaletteContext";
import { TenantProvider } from "@/lib/contexts/TenantContext";
import { TranslationProvider } from "@/lib/contexts/TranslationContext";
import { DirectionProvider } from "@/providers/DirectionProvider";
import { queryClientInstance } from "@mms/fe-core/query/queryClient";
import { UiConfigProvider } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import RootErrorBoundary from "@/components/routing/RootErrorBoundary";
import QueryDevtools from "@/components/dev/QueryDevtools";

const LazyToaster = React.lazy(() => import("@mms/ui").then((m) => ({ default: m.Toaster })));

export interface AppProvidersProps {
  children: React.ReactNode;
}

/** Bridges tenant i18n `t()` into @mms/ui's label config (cancel/confirm/delete/close). */
function UiConfigBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { t, dir, language } = useTranslation();
  return (
    <UiConfigProvider
      config={{
        dir,
        language,
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
 * Root provider composition — order must not change without reviewing auth/tenant boot.
 *
 * Tenant-only providers (module host bridges, date format, contacts config, live push) are NOT
 * mounted here: this module is inside the entry closure, so anything it imports ships in the PWA
 * precache of every visitor, including the public login/admissions pages. They live in
 * `providers/TenantScopedProviders.tsx` (mounted by the lazy `TenantRoutes` chunk) instead.
 */
export function AppProviders({ children }: AppProvidersProps): React.JSX.Element {
  return (
    <RootErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <BrandingPaletteProvider>
              <TenantProvider>
                <TranslationProvider>
                  <UiConfigBridge>
                    <DirectionProvider>{children}</DirectionProvider>
                  </UiConfigBridge>
                </TranslationProvider>
              </TenantProvider>
            </BrandingPaletteProvider>
          </Router>
          <React.Suspense fallback={null}>
            <LazyToaster />
          </React.Suspense>
          <QueryDevtools />
        </QueryClientProvider>
      </AuthProvider>
    </RootErrorBoundary>
  );
}
