import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { BrandingPaletteProvider } from "@/lib/contexts/BrandingPaletteContext";
import { TenantProvider } from "@/lib/contexts/TenantContext";
import { TranslationProvider } from "@/lib/contexts/TranslationContext";
import { DirectionProvider } from "@/providers/DirectionProvider";
import { MotionConfig } from "framer-motion";
import { queryClientInstance } from "@/lib/queryClient";
import RootErrorBoundary from "@/components/routing/RootErrorBoundary";
import QueryDevtools from "@/components/dev/QueryDevtools";

const LazyToaster = React.lazy(() =>
  import("@/components/ui/toaster").then((m) => ({ default: m.Toaster })),
);

export interface AppProvidersProps {
  children: React.ReactNode;
}

/** Root provider composition — order must not change without reviewing auth/tenant boot. */
export function AppProviders({ children }: AppProvidersProps): React.JSX.Element {
  return (
    <RootErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <BrandingPaletteProvider>
              <TenantProvider>
                <TranslationProvider>
                  <DirectionProvider>
                    <MotionConfig reducedMotion="user">{children}</MotionConfig>
                  </DirectionProvider>
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
