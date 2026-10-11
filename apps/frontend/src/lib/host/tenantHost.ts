import { getCurrentSubdomain } from "@/lib/config/tenantConfig";

/** True when the browser host is a madrasa subdomain (not platform apex). */
export function isBrowserOnTenantHost(): boolean {
  return getCurrentSubdomain() !== null;
}
