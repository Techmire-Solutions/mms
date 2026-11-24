import React from "react";
import { Navigate } from "react-router-dom";
import { usePlatformAuth } from "@/platform/features/auth/lib/PlatformAuthContext";
import { usePlatformSetupStatus } from "@/platform/features/auth/hooks/usePlatformSetupStatus";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { AuthPageFrame } from "@/components/entry/AuthPageShell";
import { useTranslation } from "@/hooks/useTranslation";
import { ErrorState } from "@shared/ui";
import { ROUTES } from "@/lib/config/routes";
import PlatformSignIn from "@/platform/features/auth/PlatformSignIn";
import PlatformSetup from "@/platform/features/auth/PlatformSetup";

/**
 * Dedicated Platform Sign-in / Setup Page (`/platform/login` or `/login`).
 * Redirects authenticated operators directly to `/platform/dashboard`.
 */
export default function PlatformLoginPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { isPlatformAuthenticated, platformAuthChecked, isCheckingPlatformAuth } =
    usePlatformAuth();
  const { setupStatus, isLoadingSetup, isError, refetch } = usePlatformSetupStatus();

  if (!platformAuthChecked || isCheckingPlatformAuth) {
    return <RouteStatusFallback fullScreen />;
  }

  if (isPlatformAuthenticated) {
    return <Navigate to={ROUTES.platformDashboard} replace />;
  }

  if (isLoadingSetup) {
    return <RouteStatusFallback fullScreen />;
  }

  if (isError) {
    return (
      <AuthPageFrame dir="ltr">
        <div className="relative z-elevated w-full max-w-md">
          <ErrorState
            title={t("platform.loadFailed")}
            description={t("platform.loadFailedHint")}
            onRetry={() => void refetch()}
          />
        </div>
      </AuthPageFrame>
    );
  }

  if (setupStatus?.needsSetup) {
    return <PlatformSetup smtpConfigured={setupStatus.smtpConfigured} />;
  }

  return <PlatformSignIn />;
}
