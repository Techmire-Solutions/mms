import React, { useEffect, Suspense } from "react";
import { isApexHost } from "@mms/shared/tenantUtils";
import { SETTINGS_PREVIEW_EVENT } from "@/lib/settingsPreview";
import { getAppDomain } from "@/lib/config/tenantConfig";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useIsTenantHost } from "@/lib/host/useIsTenantHost";
const UserNotRegisteredError = React.lazy(
  () => import("@/components/routing/UserNotRegisteredError"),
);
const HostRoutes = React.lazy(() => import("@/components/routing/HostRoutes"));
import RouterBridge from "@/components/routing/RouterBridge";
import { isEntryPath } from "@/lib/config/routes";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { AppProviders } from "@/providers/AppProviders";
import { NetworkStatusIndicator } from "@/components/ui/NetworkStatusIndicator";

const AuthenticatedApp = (): React.JSX.Element | null => {
  const isTenantHost = useIsTenantHost();
  const { isLoadingAuth, authError, authChecked } = useAuth();

  if (isTenantHost) {
    const isEntry =
      typeof window !== "undefined" && isEntryPath(window.location.pathname, { isApex: false });
    const bootLoading = !isEntry && isLoadingAuth && !authChecked;
    if (bootLoading) {
      return <RouteStatusFallback fullScreen />;
    }

    if (authError?.type === "user_not_registered") {
      return (
        <Suspense fallback={<RouteStatusFallback fullScreen />}>
          <UserNotRegisteredError />
        </Suspense>
      );
    }
  }

  return (
    <>
      <RouterBridge />
      <Suspense fallback={<RouteStatusFallback fullScreen />}>
        <HostRoutes />
      </Suspense>
      <NetworkStatusIndicator />
    </>
  );
};

function App(): React.JSX.Element {
  const isApexBoot =
    typeof window !== "undefined" && isApexHost(window.location.hostname, getAppDomain());

  useEffect(() => {
    const applyTheme = isApexBoot
      ? () =>
          import("@/platform/lib/brandingEntryTheme").then(({ applyApexPlatformTheme }) =>
            applyApexPlatformTheme("en"),
          )
      : () => import("@/lib/brandingTheme").then(({ applyAppTheme }) => applyAppTheme());

    void applyTheme();

    const onThemeUpdate = () => {
      void applyTheme();
    };
    window.addEventListener("local-database-update", onThemeUpdate);
    window.addEventListener(SETTINGS_PREVIEW_EVENT, onThemeUpdate);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      void applyTheme();
    };
    mediaQuery.addEventListener("change", listener);

    return () => {
      window.removeEventListener("local-database-update", onThemeUpdate);
      window.removeEventListener(SETTINGS_PREVIEW_EVENT, onThemeUpdate);
      mediaQuery.removeEventListener("change", listener);
    };
  }, [isApexBoot]);

  return (
    <AppProviders>
      <AuthenticatedApp />
    </AppProviders>
  );
}

export default App;
