import { ROUTES } from "@/lib/config/routes";
import { TENANT_ROUTE_LOADERS } from "@/lib/routing/moduleRegistry";
import { isCurrentHostApex } from "@/lib/config/tenantConfig";

const APEX_ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  [ROUTES.home]: () => import("@/platform/pages/ApexHome"),
  [ROUTES.tenantNotFound]: () => import("@/platform/pages/TenantNotFoundPage"),
  [ROUTES.onboarding]: () => import("@/platform/pages/onboarding/OnboardingWizard"),
  [ROUTES.platformAccount]: () => import("@/platform/pages/PlatformAccount"),
  [ROUTES.platformForgotPassword]: () => import("@/platform/pages/auth/PlatformForgotPassword"),
};

const prefetched = new Set<string>();

function loadersForCurrentHost(): Readonly<Record<string, () => Promise<unknown>>> {
  return isCurrentHostApex() ? APEX_ROUTE_LOADERS : TENANT_ROUTE_LOADERS;
}

/**
 * Warm the JS chunk for a route path (idempotent, host-aware).
 *
 * Best-effort by design:
 * - Disabled under test — a warm that resolves after the vitest environment is
 *   torn down raises an `EnvironmentTeardownError`.
 * - Loader rejections are swallowed; a failed warm must never surface as an
 *   unhandled rejection.
 */
export function prefetchRoute(path: string): void {
  if (import.meta.env.MODE === "test") return;

  const loader = loadersForCurrentHost()[path];
  if (!loader || prefetched.has(path)) {
    return;
  }
  prefetched.add(path);
  loader().catch(() => {
    // Ignore — prefetch is an optimisation, not a correctness requirement.
  });
}
