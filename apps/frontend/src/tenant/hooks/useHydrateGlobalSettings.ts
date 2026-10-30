import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTenant } from "@/lib/contexts/TenantContext";
import { isEntryPath } from "@/lib/config/routes";
import { hydrateGlobalSettingsFromServer } from "@/lib/globalSettingsHydration";

/** One successful (or failed-open) hydration per tenant per page session. */
const hydratedTenants = new Set<string>();

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
    void hydrateGlobalSettingsFromServer()
      .catch(() => {
        // Fail open: device-local settings remain usable offline.
      })
      .finally(() => {
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
