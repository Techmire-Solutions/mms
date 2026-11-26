import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { roleHasPermission } from "@mms/contracts";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { useTenant } from "@mms/fe-core/tenant";
import { isEntryPath } from "@mms/fe-core/config/routes";
import { hydrateBrandingFromServer } from "@/lib/brandingHydration";

/** One successful (or failed-open) hydration per tenant per page session. */
const hydratedTenants = new Set<string>();
/** In-flight hydrations per subdomain — StrictMode remounts reuse the running fetch. */
const hydrationInFlight = new Map<string, Promise<boolean>>();

/**
 * Hydrates the full institution branding record from PostgreSQL once per authenticated
 * tenant session for branding writers. Without it, Settings → Institution (and the
 * first-run institution setup) start from the public branding subset and a save would
 * overwrite the stored contact/legal/address/social fields with empty values.
 */
export function useHydrateBranding(): { isHydrating: boolean } {
  const { user, isAuthenticated, authChecked } = useAuth();
  const { isApex, subdomain, workspace } = useTenant();
  const { pathname } = useLocation();
  const [completedSubdomain, setCompletedSubdomain] = useState<string | null>(null);
  const canHydrate =
    !isApex &&
    Boolean(subdomain) &&
    Boolean(workspace) &&
    authChecked &&
    isAuthenticated &&
    roleHasPermission(user?.role, "settings.branding.write") &&
    !isEntryPath(pathname, { isApex: false });
  const isHydrating = Boolean(
    canHydrate && subdomain && completedSubdomain !== subdomain && !hydratedTenants.has(subdomain),
  );

  useEffect(() => {
    if (!canHydrate || !subdomain || hydratedTenants.has(subdomain)) return;

    let active = true;
    const pending = hydrationInFlight.get(subdomain) ?? hydrateBrandingFromServer();
    hydrationInFlight.set(subdomain, pending);

    void pending
      .catch(() => {
        // Fail open: the cached branding stays usable offline.
      })
      .finally(() => {
        hydrationInFlight.delete(subdomain);
        hydratedTenants.add(subdomain);
        if (active) setCompletedSubdomain(subdomain);
      });

    return () => {
      active = false;
    };
  }, [canHydrate, subdomain]);

  return { isHydrating };
}

/** Test hook: forget per-session hydration state. */
export function resetBrandingHydrationForTests(): void {
  hydratedTenants.clear();
  hydrationInFlight.clear();
}
