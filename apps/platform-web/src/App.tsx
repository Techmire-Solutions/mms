import React, { useEffect, Suspense } from "react";
import { SETTINGS_PREVIEW_EVENT } from "@mms/fe-core/lib/settingsPreview";
import { subscribePlatformBranding } from "@mms/fe-core/lib/platformBrandingStore";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import RouterBridge from "@/components/routing/RouterBridge";
import { AppProviders } from "@/providers/AppProviders";
import { MotionPreferences } from "@/providers/MotionPreferences";
import { PlatformAuthProvider } from "@/platform/features/auth/lib/PlatformAuthContext";

const ApexRoutesWithSuspense = React.lazy(() =>
  import("@/platform/routes/ApexRoutes").then((m) => ({ default: m.ApexRoutesWithSuspense })),
);

function App(): React.JSX.Element {
  useEffect(() => {
    const applyTheme = () =>
      import("@mms/fe-core/lib/apexPlatformTheme").then(({ applyApexPlatformTheme }) =>
        applyApexPlatformTheme("en"),
      );
    void applyTheme();
    const onThemeUpdate = () => {
      void applyTheme();
    };
    window.addEventListener("local-database-update", onThemeUpdate);
    window.addEventListener(SETTINGS_PREVIEW_EVENT, onThemeUpdate);
    const unsubscribePlatformBranding = subscribePlatformBranding(onThemeUpdate);
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      void applyTheme();
    };
    mediaQuery.addEventListener("change", listener);
    return () => {
      window.removeEventListener("local-database-update", onThemeUpdate);
      window.removeEventListener(SETTINGS_PREVIEW_EVENT, onThemeUpdate);
      unsubscribePlatformBranding();
      mediaQuery.removeEventListener("change", listener);
    };
  }, []);

  return (
    <AppProviders>
      <MotionPreferences>
        <PlatformAuthProvider>
          <RouterBridge />
          <Suspense fallback={<RouteStatusFallback fullScreen />}>
            <ApexRoutesWithSuspense />
          </Suspense>
        </PlatformAuthProvider>
      </MotionPreferences>
    </AppProviders>
  );
}

export default App;
