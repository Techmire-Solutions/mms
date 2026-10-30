import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ROUTES, TENANT_APP_PATHS } from "@/lib/config/routes";
import PlatformBootGate, { PlatformFallbackRoute } from "@/platform/components/PlatformBootGate";
import { PlatformFirstRunGate } from "@/platform/components/PlatformFirstRunGate";
import { PlatformPageShell } from "@/platform/components/PlatformPageShell";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { PlatformAuthProvider } from "@/platform/lib/PlatformAuthContext";
import { ApexBootPrefetch } from "@/platform/components/ApexBootPrefetch";
import { MotionPreferences } from "@/providers/MotionPreferences";
import {
  PLATFORM_CONSOLE_GROUPS,
  type ApexConsoleEntry,
  type ApexConsoleGroup,
} from "@/platform/routes/apexRouteRegistry";

const ApexHome = React.lazy(() => import("@/platform/pages/ApexHome"));
const ApexWorkspaceGate = React.lazy(() => import("@/platform/pages/ApexWorkspaceGate"));
const TenantNotFoundPage = React.lazy(() => import("@/platform/pages/TenantNotFoundPage"));
const PlatformForgotPassword = React.lazy(
  () => import("@/platform/pages/auth/PlatformForgotPassword"),
);
const PlatformLoginPage = React.lazy(() => import("@/platform/pages/auth/PlatformLoginPage"));

/**
 * Stable id → lazy page component. Built once at module scope so `React.lazy`
 * is not re-created per render (which would remount the page).
 */
const CONSOLE_PAGES = new Map<string, React.LazyExoticComponent<React.ComponentType>>(
  PLATFORM_CONSOLE_GROUPS.flatMap((group) =>
    group.entries
      .filter((entry) => entry.loader)
      .map(
        (entry) =>
          [
            entry.id,
            React.lazy(entry.loader as () => Promise<{ default: React.ComponentType }>),
          ] as const,
      ),
  ),
);

const apexTenantGate = <ApexWorkspaceGate variant="tenantOnly" showWorkspaceList />;

function renderConsoleEntry(entry: ApexConsoleEntry): React.JSX.Element {
  if (entry.redirectTo) {
    return (
      <Route
        key={entry.id}
        path={entry.path}
        element={<Navigate to={entry.redirectTo} replace />}
      />
    );
  }
  const Page = CONSOLE_PAGES.get(entry.id)!;
  return (
    <Route
      key={entry.id}
      path={entry.path}
      element={
        <React.Suspense fallback={<RouteStatusFallback />}>
          <Page />
        </React.Suspense>
      }
    />
  );
}

function renderConsoleGroup(group: ApexConsoleGroup): React.JSX.Element {
  const pages = <>{group.entries.map(renderConsoleEntry)}</>;
  // Groups are shell-homogeneous today (only `onboard` opts out).
  const useShell = group.entries.some((entry) => entry.shell !== false);
  return (
    <Route
      key={group.permission ?? "authenticated"}
      element={<PlatformBootGate requireAuth requirePermission={group.permission ?? undefined} />}
    >
      {useShell ? (
        <Route
          element={
            <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
              <PlatformPageShell width="7xl" />
            </React.Suspense>
          }
        >
          {pages}
        </Route>
      ) : (
        pages
      )}
    </Route>
  );
}

/**
 * Platform apex route tree — public entry routes vs platform-auth-protected admin routes.
 * Dedicated sign-in lives at `/platform/login` (`ROUTES.platformLogin`), dedicated dashboard at `/platform/dashboard`.
 * Protected console routes are derived from `@/platform/routes/apexRouteRegistry`.
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

      {/* Protected platform console — grouped by required permission (registry SSOT) */}
      {PLATFORM_CONSOLE_GROUPS.map(renderConsoleGroup)}

      <Route path="*" element={<PlatformFallbackRoute />} />
    </Routes>
  );
}

export function ApexRoutesWithSuspense(): React.JSX.Element {
  return (
    <MotionPreferences>
      <PlatformAuthProvider>
        <ApexBootPrefetch />
        <React.Suspense fallback={<RouteStatusFallback fullScreen />}>
          <ApexRoutes />
        </React.Suspense>
      </PlatformAuthProvider>
    </MotionPreferences>
  );
}
