import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { requiresTwoFactor, roleHasPermission } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { DEFAULT_AUTH_REDIRECT, ROUTES } from "@/lib/config/routes";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { is2FAPending, is2FAVerified } from "@/lib/twoFactor";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { ErrorState } from "@/components/ui/ErrorState";
import { useInstitutionSetupStatus } from "@/tenant/hooks/useInstitutionSetupStatus";

/**
 * Requires an authenticated session. Redirects guests to login with return path.
 * When global 2FA is required, blocks access until verification completes.
 * When temporary password is active, forces password change.
 * When institution profile is incomplete, forces initial institution setup.
 */
export default function ProtectedRoute(): React.JSX.Element {
  const { isAuthenticated, user } = useAuth();
  const settings = useGlobalSettings();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const canCompleteInstitutionSetup = roleHasPermission(user?.role, "settings.branding.write");
  const institutionSetupStatus = useInstitutionSetupStatus(
    isAuthenticated && canCompleteInstitutionSetup && !user?.mustChangePassword,
  );

  if (!isAuthenticated) {
    if (is2FAPending()) {
      return <Navigate to={ROUTES.twoFactor} replace state={{ from: returnTo }} />;
    }
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ from: location.pathname !== ROUTES.login ? returnTo : DEFAULT_AUTH_REDIRECT }}
      />
    );
  }

  if (requiresTwoFactor(settings, user) && !is2FAVerified()) {
    return <Navigate to={ROUTES.twoFactor} replace state={{ from: returnTo }} />;
  }

  if (user?.mustChangePassword) {
    if (location.pathname !== ROUTES.forcePasswordChange) {
      return <Navigate to={ROUTES.forcePasswordChange} replace />;
    }
    return <Outlet />;
  }

  if (canCompleteInstitutionSetup && institutionSetupStatus.isLoading) {
    return <RouteStatusFallback fullScreen />;
  }

  if (canCompleteInstitutionSetup && institutionSetupStatus.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <ErrorState type="network" onRetry={() => void institutionSetupStatus.refetch()} />
      </div>
    );
  }

  if (canCompleteInstitutionSetup && institutionSetupStatus.data === false) {
    if (location.pathname !== ROUTES.institutionSetup) {
      return <Navigate to={ROUTES.institutionSetup} replace />;
    }
    return <Outlet />;
  }

  return <Outlet />;
}
