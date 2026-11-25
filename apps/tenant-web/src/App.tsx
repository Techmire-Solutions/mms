import React, { useEffect, Suspense } from "react";
import { SETTINGS_PREVIEW_EVENT } from "@mms/fe-core/lib/settingsPreview";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { isEntryPath } from "@mms/fe-core/config/routes";
import { shouldShowUserNotRegisteredOverlay } from "@/lib/contexts/authErrorOverlay";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { AppProviders } from "@/providers/AppProviders";
import RouterBridge from "@/components/routing/RouterBridge";

const TenantRoutes = React.lazy(() => import("@/tenant/routes/TenantRoutes"));
const UserNotRegisteredError = React.lazy(
  () => import("@/components/routing/UserNotRegisteredError"),
);

const LazyNetworkStatusIndicator = React.lazy(() =>
  import("@mms/fe-core/components/NetworkStatusIndicator").then((m) => ({
    default: m.NetworkStatusIndicator,
  })),
);

const AuthenticatedTenant = (): React.JSX.Element | null => {
  const { isLoadingAuth, authError, authChecked } = useAuth();

  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const isEntry = pathname !== "" && isEntryPath(pathname, { isApex: false });
  const bootLoading = !isEntry && isLoadingAuth && !authChecked;
  if (bootLoading) {
    return <RouteStatusFallback fullScreen />;
  }

  if (
    shouldShowUserNotRegisteredOverlay({
      isTenantHost: true,
      pathname,
      authErrorType: authError?.type,
    })
  ) {
    return (
      <Suspense fallback={<RouteStatusFallback fullScreen />}>
        <UserNotRegisteredError />
      </Suspense>
    );
  }

  return (
    <>
      <RouterBridge />
      <Suspense fallback={<RouteStatusFallback fullScreen />}>
        <TenantRoutes />
      </Suspense>
      <Suspense fallback={null}>
        <LazyNetworkStatusIndicator />
      </Suspense>
    </>
  );
};

function App(): React.JSX.Element {
  useEffect(() => {
    const applyTheme = () =>
      import("@mms/fe-core/lib/brandingTheme").then(({ applyAppTheme }) => applyAppTheme());

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
  }, []);

  return (
    <AppProviders>
      <AuthenticatedTenant />
    </AppProviders>
  );
}

export default App;
