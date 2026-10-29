import React from "react";
import { Navigate } from "react-router-dom";
import { roleHasPermission, type Permission } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ROUTES } from "@/lib/config/routes";

/**
 * Requires the signed-in user's role to hold `permission`.
 *
 * Runs inside `ProtectedRoute`, so authentication / 2FA / forced password change
 * have already been handled. Used for surfaces that are outside the module-access
 * shell but are not safe for every authenticated role.
 */
export default function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}): React.JSX.Element {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} replace />;
  }
  if (!roleHasPermission(user?.role, permission)) {
    return <Navigate to={ROUTES.home} replace />;
  }
  return <>{children}</>;
}
