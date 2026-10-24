import React from "react";
import { Navigate } from "react-router-dom";
import { usePlatformAuth } from "@/platform/lib/PlatformAuthContext";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { ROUTES } from "@/lib/config/routes";

/**
 * Apex root path (`/`) decision router:
 * 1. Authenticated → redirect to `/platform/dashboard`
 * 2. Otherwise → redirect to `/platform/login`
 */
export default function ApexHome(): React.JSX.Element {
  const { isPlatformAuthenticated, platformAuthChecked, isCheckingPlatformAuth } =
    usePlatformAuth();

  if (!platformAuthChecked || isCheckingPlatformAuth) {
    return <RouteStatusFallback fullScreen />;
  }

  if (isPlatformAuthenticated) {
    return <Navigate to={ROUTES.platformDashboard} replace />;
  }

  return <Navigate to={ROUTES.platformLogin} replace />;
}
