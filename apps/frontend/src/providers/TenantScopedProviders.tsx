import React from "react";
import { ContactConfigProvider } from "@/lib/contexts/ContactConfigContext";
import { DateFormatProvider } from "@/lib/contexts/DateFormatContext";
import { useIsTenantHost } from "@/lib/host/useIsTenantHost";
import { useTenantDatabaseUpdates } from "@/hooks/useTenantDatabaseUpdates";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";

import { isInstitutionSetupComplete } from "@mms/shared";
import { useBranding } from "@/tenant/hooks/useBranding";

function TenantLivePushSubscriber(): null {
  useTenantDatabaseUpdates();
  return null;
}

/** Mounts tenant-only providers (contacts config + date format + live push) — live push is active only when authenticated. */
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
        {shouldSubscribeLivePush ? <TenantLivePushSubscriber /> : null}
        {children}
      </ContactConfigProvider>
    </DateFormatProvider>
  );
}
