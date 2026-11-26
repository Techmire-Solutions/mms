import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { useTenant } from "@mms/fe-core/tenant";
import { isEntryPath } from "@mms/fe-core/config/routes";
import { hydrateGlobalSettingsFromServer } from "@/lib/globalSettingsHydration";

/** One successful (or failed-open) hydration per tenant per page session. */
const hydratedTenants = new Set<string>();
/** In-flight hydrations per subdomain — StrictMode remounts reuse the running fetch. */
const hydrationInFlight = new Map<string, Promise<void>>();

/**
 * Hydrates localization fields from PostgreSQL once per authenticated tenant
 * session. Language previously lived only in localStorage, so a new browser
 * silently reset the workspace to English.
 */
export function useHydrateGlobalSettings(): { isHydrating: boolean } {
  const { isAuthenticated, authChecked } = useAuth();
  const { isApex, subdomain, workspace } = useTenant();
  const { pathname } = useLocation();
  const [completedSubdomain, setCompletedSubdomain] = useState<string | null>(null);
  const canHydrate =
    !isApex &&
    Boolean(subdomain) &&
    Boolean(workspace) &&
    authChecked &&
    isAuthenticated &&
    !isEntryPath(pathname, { isApex: false });
  const isHydrating = Boolean(
    canHydrate && subdomain && completedSubdomain !== subdomain && !hydratedTenants.has(subdomain),
  );

  useEffect(() => {
    if (!canHydrate || !subdomain || hydratedTenants.has(subdomain)) return;

    let active = true;
    // Single-flight per tenant: a remount (StrictMode, route churn) reuses the
    // running hydration instead of racing a second fetch into the same store.
    const pending = hydrationInFlight.get(subdomain) ?? hydrateGlobalSettingsFromServer();
    hydrationInFlight.set(subdomain, pending);

    void pending
      .catch(() => {
        // Fail open: device-local settings remain usable offline.
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

export { mergeServerLocalization } from "@/lib/globalSettingsHydration";
