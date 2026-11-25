import React from "react";
import { ContactConfigProvider } from "@mms/mod-contacts/frontend/tenant/components/ContactConfigContext";
import { DateFormatProvider } from "@mms/fe-core/components/DateFormatContext";
import { useIsTenantHost } from "@/lib/host/useIsTenantHost";
import { useTenantDatabaseUpdates } from "@/hooks/useTenantDatabaseUpdates";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";

import { isInstitutionSetupComplete } from "@mms/contracts";
import { useBranding } from "@/tenant/hooks/useBranding";
import { ContactsHostBridge } from "@/providers/ContactsHostProvider";
import { HasanatHostBridge } from "@/providers/HasanatHostProvider";

function TenantLivePushSubscriber(): null {
  useTenantDatabaseUpdates();
  return null;
}

/**
 * Mounts tenant-only providers (module host bridges + contacts config + date format + live push) —
 * live push is active only when authenticated. Kept out of `AppProviders` so the shell's entry
 * closure stays small (see the check:pwa budget in `scripts/check-pwa-precache.mjs`).
 */
export default function TenantScopedProviders({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const isTenantHost = useIsTenantHost();
  const { isAuthenticated, user, authChecked } = useAuth();
  const branding = useBranding();
  const globalSettings = useGlobalSettings();

  if (!isTenantHost) {
    return <>{children}</>;
  }

  const shouldSubscribeLivePush = Boolean(
    authChecked &&
    isAuthenticated &&
    user &&
    !user.mustChangePassword &&
    isInstitutionSetupComplete(branding),
  );

  return (
    <DateFormatProvider value={globalSettings.dateFormat}>
      <ContactConfigProvider>
        {/* Module host bridges are tenant-only: their consumers are the tenant module pages. Mounting
            them in AppProviders (entry closure) pulled ~3.4 MB of module report/vendor code into the
            PWA precache — check:pwa failed on the forbidden vendor-motion chunk. They live here, with
            the other tenant-scoped providers, inside the lazy TenantRoutes chunk. */}
        <ContactsHostBridge>
          <HasanatHostBridge>
            {shouldSubscribeLivePush ? <TenantLivePushSubscriber /> : null}
            {children}
          </HasanatHostBridge>
        </ContactsHostBridge>
      </ContactConfigProvider>
    </DateFormatProvider>
  );
}
