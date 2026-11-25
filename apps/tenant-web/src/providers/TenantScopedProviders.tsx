import React from "react";
import { DateFormatProvider } from "@mms/fe-core/components/DateFormatContext";
import { useIsTenantHost } from "@/lib/host/useIsTenantHost";
import { useTenantDatabaseUpdates } from "@/hooks/useTenantDatabaseUpdates";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";

import { isInstitutionSetupComplete } from "@mms/contracts";
import { useBranding } from "@/tenant/hooks/useBranding";

function TenantLivePushSubscriber(): null {
  useTenantDatabaseUpdates();
  return null;
}

/**
 * Mounts tenant-only shell providers (date format + live push) — live push is active only when
 * authenticated. Heavy module host bridges and `ContactConfigProvider` live inside the lazy
 * authenticated `AppLayout` chunk so public/unauthenticated entry routes keep their bundle small.
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
      {shouldSubscribeLivePush ? <TenantLivePushSubscriber /> : null}
      {children}
    </DateFormatProvider>
  );
}
