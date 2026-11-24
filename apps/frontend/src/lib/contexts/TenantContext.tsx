import React from "react";
import { TenantProvider as CoreTenantProvider } from "@mms/fe-core/tenant";
import { cachePublicBranding } from "@/lib/dbObjects";

export type { PublicWorkspace, TenantContextValue } from "@mms/fe-core/tenant";
export { useTenant, useOptionalTenant } from "@mms/fe-core/tenant";

/**
 * App adapter: supplies the offline branding cache to the fe-core tenant provider.
 */
export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <CoreTenantProvider cacheBranding={cachePublicBranding}>{children}</CoreTenantProvider>
);
