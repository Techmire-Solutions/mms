import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { requiresTwoFactor } from "@mms/contracts";
import { useAuth } from "@/lib/contexts/AuthContext";
import { DEFAULT_AUTH_REDIRECT, ROUTES } from "@/lib/config/routes";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { is2FAVerified } from "@/lib/twoFactor";

/**
 * For login / forgot-password — redirects fully authenticated users to the app.
 * Skips redirect when 2FA is still required but not yet verified.
 */
export default function GuestRoute(): React.JSX.Element {
  const { isAuthenticated, user } = useAuth();
  const settings = useGlobalSettings();

  if (isAuthenticated) {
    const needs2FA = requiresTwoFactor(settings, user) && !is2FAVerified();
    if (user?.mustChangePassword && !needs2FA) {
      return <Navigate to={ROUTES.forcePasswordChange} replace />;
    }
    if (!needs2FA) {
      return <Navigate to={DEFAULT_AUTH_REDIRECT} replace />;
    }
  }

  return <Outlet />;
}
