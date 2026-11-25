import { useTenant } from "@/lib/contexts/TenantContext";
import { isBrowserOnTenantHost } from "@/lib/host/tenantHost";

/** True when the active route tree should be tenant (madrasa subdomain), not platform apex. */
export function useIsTenantHost(): boolean {
  const { isApex } = useTenant();
  return !isApex || isBrowserOnTenantHost();
}
