import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTES, TENANT_APP_PATHS } from "@/lib/config/routes";
import PlatformBootGate, { PlatformFallbackRoute } from "@/platform/components/PlatformBootGate";
import { PlatformFirstRunGate } from "@/platform/components/PlatformFirstRunGate";
import { PlatformPageShell } from "@/platform/components/PlatformPageShell";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { PlatformAuthProvider } from "@/platform/lib/PlatformAuthContext";
import { ApexBootPrefetch } from "@/platform/components/ApexBootPrefetch";

const ApexHome = React.lazy(() => import("@/platform/pages/ApexHome"));
const ApexWorkspaceGate = React.lazy(() => import("@/platform/pages/ApexWorkspaceGate"));
const TenantNotFoundPage = React.lazy(() => import("@/platform/pages/TenantNotFoundPage"));
const OnboardingWizard = React.lazy(() => import("@/platform/pages/onboarding/OnboardingWizard"));
const PlatformAccount = React.lazy(() => import("@/platform/pages/PlatformAccount"));
const PlatformForgotPassword = React.lazy(
  () => import("@/platform/pages/auth/PlatformForgotPassword"),
);
const PlatformLoginPage = React.lazy(() => import("@/platform/pages/auth/PlatformLoginPage"));
const PlatformDashboardPage = React.lazy(() => import("@/platform/pages/PlatformDashboardPage"));
const PlatformWorkspacesPage = React.lazy(() => import("@/platform/pages/PlatformWorkspacesPage"));
const PlatformReportsPage = React.lazy(() => import("@/platform/pages/PlatformReportsPage"));
const PlatformActivityLogsPage = React.lazy(
  () => import("@/platform/pages/PlatformActivityLogsPage"),
);
const PlatformSystemPage = React.lazy(() => import("@/platform/pages/PlatformSystemPage"));
const PlatformUsersPage = React.lazy(() => import("@/platform/pages/PlatformUsersPage"));
const PlatformSettingsPage = React.lazy(() => import("@/platform/pages/PlatformSettingsPage"));
const PlatformErdPage = React.lazy(() => import("@/platform/pages/PlatformErdPage"));
const PlatformDesignSystemPage = React.lazy(
  () => import("@/platform/pages/PlatformDesignSystemPage"),
);

const apexTenantGate = <ApexWorkspaceGate variant="tenantOnly" showWorkspaceList />;

/**
 * Platform apex route tree — public entry routes vs platform-auth-protected admin routes.
 * Dedicated sign-in lives at `/platform/login` (`ROUTES.platformLogin`), dedicated dashboard at `/platform/dashboard`.
 */
export default function ApexRoutes(): React.JSX.Element {
  return (
    <Routes>
      {/* Entry — no platform session required */}
      <Route
        path={ROUTES.home}
        element={
          <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
            <ApexHome />
          </React.Suspense>
        }
      />
      <Route
        path={ROUTES.login}
        element={
          <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
            <PlatformLoginPage />
          </React.Suspense>
        }
      />
      <Route
        path={ROUTES.platformLogin}
        element={
          <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
            <PlatformLoginPage />
          </React.Suspense>
        }
      />
      <Route
        path={ROUTES.tenantNotFound}
        element={
          <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
            <TenantNotFoundPage />
          </React.Suspense>
        }
      />
      <Route
        path={ROUTES.forgotPassword}
        element={
          <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
            <ApexWorkspaceGate variant="forgotPassword" showWorkspaceList />
          </React.Suspense>
        }
      />
      <Route element={<PlatformFirstRunGate />}>
        <Route
          path={ROUTES.platformForgotPassword}
          element={
            <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
              <PlatformForgotPassword />
            </React.Suspense>
          }
        />
      </Route>
      <Route
        path={ROUTES.twoFactor}
        element={
          <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
            <ApexWorkspaceGate variant="twoFactor" showWorkspaceList={false} />
          </React.Suspense>
        }
      />
      <Route path={`${ROUTES.settings}/*`} element={apexTenantGate} />
      {TENANT_APP_PATHS.map((path) => (
        <Route key={path} path={path} element={apexTenantGate} />
      ))}

      {/* Protected platform routes — BootGate sends unauthenticated users to `/platform/login` */}
      <Route element={<PlatformBootGate requireAuth />}>
        <Route
          element={
            <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
              <PlatformPageShell width="7xl" />
            </React.Suspense>
          }
        >
          <Route
            path={ROUTES.platformAccount}
            element={
              <React.Suspense fallback={<RouteStatusFallback />}>
                <PlatformAccount />
              </React.Suspense>
            }
          />
          <Route
            path={ROUTES.platformDashboard}
            element={
              <React.Suspense fallback={<RouteStatusFallback />}>
                <PlatformDashboardPage />
              </React.Suspense>
            }
          />
        </Route>
      </Route>
      <Route element={<PlatformBootGate requireAuth requirePermission="workspaces" />}>
        <Route
          element={
            <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
              <PlatformPageShell width="7xl" />
            </React.Suspense>
          }
        >
          <Route
            path={ROUTES.platformWorkspaces}
            element={
              <React.Suspense fallback={<RouteStatusFallback />}>
                <PlatformWorkspacesPage />
              </React.Suspense>
            }
          />
          <Route
            path={ROUTES.platformReports}
            element={
              <React.Suspense fallback={<RouteStatusFallback />}>
                <PlatformReportsPage />
              </React.Suspense>
            }
          />
        </Route>
      </Route>
      <Route element={<PlatformBootGate requireAuth requirePermission="onboard" />}>
        <Route
          path={ROUTES.onboarding}
          element={
            <React.Suspense fallback={<RouteStatusFallback />}>
              <OnboardingWizard />
            </React.Suspense>
          }
        />
      </Route>
      <Route element={<PlatformBootGate requireAuth requirePermission="admins" />}>
        <Route
          element={
            <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
              <PlatformPageShell width="7xl" />
            </React.Suspense>
          }
        >
          <Route
            path={ROUTES.platformUsers}
            element={
              <React.Suspense fallback={<RouteStatusFallback />}>
                <PlatformUsersPage />
              </React.Suspense>
            }
          />
          <Route
            path={ROUTES.platformAdmins}
            element={<Navigate to={ROUTES.platformUsers} replace />}
          />
        </Route>
      </Route>
      <Route element={<PlatformBootGate requireAuth requirePermission="settings" />}>
        <Route
          element={
            <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
              <PlatformPageShell width="7xl" />
            </React.Suspense>
          }
        >
          <Route
            path={ROUTES.platformSettings}
            element={
              <React.Suspense fallback={<RouteStatusFallback />}>
                <PlatformSettingsPage />
              </React.Suspense>
            }
          />
        </Route>
      </Route>
      <Route element={<PlatformBootGate requireAuth requirePermission="system" />}>
        <Route
          element={
            <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
              <PlatformPageShell width="7xl" />
            </React.Suspense>
          }
        >
          <Route
            path={ROUTES.platformActivityLogs}
            element={
              <React.Suspense fallback={<RouteStatusFallback />}>
                <PlatformActivityLogsPage />
              </React.Suspense>
            }
          />
          <Route
            path={ROUTES.platformSystem}
            element={
              <React.Suspense fallback={<RouteStatusFallback />}>
                <PlatformSystemPage />
              </React.Suspense>
            }
          />
          <Route
            path={ROUTES.platformErd}
            element={
              <React.Suspense fallback={<RouteStatusFallback />}>
                <PlatformErdPage />
              </React.Suspense>
            }
          />
          <Route
            path={ROUTES.platformDesignSystem}
            element={
              <React.Suspense fallback={<RouteStatusFallback />}>
                <PlatformDesignSystemPage />
              </React.Suspense>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<PlatformFallbackRoute />} />
    </Routes>
  );
}

export function ApexRoutesWithSuspense(): React.JSX.Element {
  return (
    <PlatformAuthProvider>
      <ApexBootPrefetch />
      <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
        <ApexRoutes />
      </React.Suspense>
    </PlatformAuthProvider>
  );
}
