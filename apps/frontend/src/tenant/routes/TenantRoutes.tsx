import React from "react";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { useTenant } from "@/lib/contexts/TenantContext";
import { ROUTES, tenantNotFoundPath } from "@/lib/config/routes";
import { TENANT_APP_ENTRIES } from "@/lib/routing/moduleRegistry";
import { apexUrl } from "@/lib/config/tenantConfig";
import ProtectedRoute from "@/tenant/components/guards/ProtectedRoute";
import GuestRoute from "@/tenant/components/guards/GuestRoute";
import ModuleAccessRoute from "@/tenant/components/guards/ModuleAccessRoute";
import WorkspaceDisabledScreen from "@/tenant/components/WorkspaceDisabledScreen";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { AuthPageFrame } from "@/components/entry";
import { ErrorState } from "@/components/app/ErrorState";
import { useTranslation } from "@/hooks/useTranslation";

const AppLayout = React.lazy(() => import("@/tenant/components/layout/AppLayout"));
const PageNotFound = React.lazy(() => import("@/tenant/components/PageNotFound"));

const Login = React.lazy(() => import("@/tenant/pages/auth/Login"));
const ForgotPassword = React.lazy(() => import("@/tenant/pages/auth/ForgotPassword"));
const TwoFactorAuth = React.lazy(() => import("@/tenant/pages/auth/TwoFactorAuth"));
const ForcePasswordChange = React.lazy(() => import("@/tenant/pages/auth/ForcePasswordChange"));
const InstitutionSetup = React.lazy(() => import("@/tenant/pages/setup/InstitutionSetup"));
const OpenRegistrations = React.lazy(() => import("@/tenant/pages/apply/OpenRegistrationsPage"));
const RegistrationForm = React.lazy(() => import("@/tenant/pages/apply/RegistrationFormPage"));

/** Module + landing routes derived from the registry; each page is code-split. */
const TENANT_APP_ROUTES = TENANT_APP_ENTRIES.map((entry) => ({
  path: entry.path,
  Component: React.lazy(() => entry.loader() as Promise<{ default: React.ComponentType }>),
}));

function RedirectToApex({ path }: { path: string }): React.JSX.Element {
  React.useEffect(() => {
    window.location.href = apexUrl(path);
  }, [path]);

  return <RouteStatusFallback fullScreen />;
}

/**
 * Blocks all tenant app routes (including `/settings`) when the host subdomain
 * has no registered workspace. Hard-redirects to the apex platform
 * `/tenant-not-found?subdomain=` page — never leave the browser on the bad host.
 */
function TenantBootGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { t } = useTranslation();
  const {
    workspaceLoading,
    workspaceMissing,
    workspaceLookupFailed,
    workspace,
    subdomain,
    refetchWorkspace,
  } = useTenant();
  const location = useLocation();

  if (workspaceLoading) {
    return <RouteStatusFallback fullScreen />;
  }

  if (workspaceMissing && subdomain) {
    return <RedirectToApex path={tenantNotFoundPath(subdomain)} />;
  }

  if (workspaceLookupFailed) {
    return (
      <AuthPageFrame dir="ltr">
        <div className="relative z-elevated mx-auto w-full max-w-md">
          <ErrorState
            type="network"
            title={t("errors.boundary.title")}
            description={t("errors.boundary.description")}
            onRetry={refetchWorkspace}
          />
        </div>
      </AuthPageFrame>
    );
  }

  if (workspace && workspace.enabled === false) {
    if (location.pathname !== ROUTES.home) {
      return <Navigate to={ROUTES.home} replace />;
    }
    return (
      <WorkspaceDisabledScreen
        madrasaName={workspace.madrasaName}
        subdomain={workspace.subdomain}
      />
    );
  }

  return <>{children}</>;
}

/**
 * Tenant madrasa route tree — login, dashboard, and module pages on {slug}.{domain}.
 */
function TenantRoutesInner(): React.JSX.Element {
  return (
    <TenantBootGate>
      <Routes>
        <Route path={ROUTES.onboarding} element={<RedirectToApex path={ROUTES.onboarding} />} />

        <Route
          path={ROUTES.twoFactor}
          element={
            <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
              <TwoFactorAuth />
            </React.Suspense>
          }
        />
        {/* Public admissions: no sign-in, reachable whether or not someone is logged in. */}
        <Route
          path={ROUTES.apply}
          element={
            <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
              <OpenRegistrations />
            </React.Suspense>
          }
        />
        <Route
          path={`${ROUTES.apply}/:slug`}
          element={
            <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
              <RegistrationForm />
            </React.Suspense>
          }
        />
        <Route element={<GuestRoute />}>
          <Route
            path={ROUTES.login}
            element={
              <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
                <Login />
              </React.Suspense>
            }
          />
          <Route
            path={ROUTES.forgotPassword}
            element={
              <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
                <ForgotPassword />
              </React.Suspense>
            }
          />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route
            path={ROUTES.forcePasswordChange}
            element={
              <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
                <ForcePasswordChange />
              </React.Suspense>
            }
          />
          <Route
            path={ROUTES.institutionSetup}
            element={
              <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
                <InstitutionSetup />
              </React.Suspense>
            }
          />
          <Route
            element={
              <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
                <AppLayout />
              </React.Suspense>
            }
          >
            <Route element={<ModuleAccessRoute />}>
              {TENANT_APP_ROUTES.map(({ path, Component }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <React.Suspense fallback={<RouteStatusFallback />}>
                      <Component />
                    </React.Suspense>
                  }
                />
              ))}
              <Route
                path={`${ROUTES.settings}/:section`}
                element={<Navigate to={ROUTES.settings} replace />}
              />
            </Route>
          </Route>
        </Route>

        <Route
          path="*"
          element={
            <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
              <PageNotFound />
            </React.Suspense>
          }
        />
      </Routes>
    </TenantBootGate>
  );
}

import TenantScopedProviders from "@/providers/TenantScopedProviders";

export default function TenantRoutes(): React.JSX.Element {
  return (
    <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
      <TenantScopedProviders>
        <TenantRoutesInner />
      </TenantScopedProviders>
    </React.Suspense>
  );
}
