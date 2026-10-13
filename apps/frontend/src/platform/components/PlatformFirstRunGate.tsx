import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { usePlatformAuth } from "@/platform/lib/PlatformAuthContext";
import { usePlatformSetupStatus } from "@/platform/hooks/usePlatformSetupStatus";
import { ROUTES } from "@/lib/config/routes";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { ErrorState } from "@/components/app/ErrorState";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * When the platform has no users yet, force first-run super-user setup on `/`.
 * Blocks alternate apex auth entry (e.g. forgot-password) until setup completes.
 */
export function PlatformFirstRunGate(): React.JSX.Element {
  const { t } = useTranslation();
  const location = useLocation();
  const { isPlatformAuthenticated, platformAuthChecked, isCheckingPlatformAuth } =
    usePlatformAuth();
  const { setupStatus, isLoadingSetup, isError, refetch } = usePlatformSetupStatus();

  if (!platformAuthChecked || isCheckingPlatformAuth || isLoadingSetup) {
    return <RouteStatusFallback fullScreen />;
  }

  if (isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <ErrorState
          title={t("platform.loadFailed")}
          description={t("platform.loadFailedHint")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!isPlatformAuthenticated && setupStatus?.needsSetup && location.pathname !== ROUTES.home) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return <Outlet />;
}
