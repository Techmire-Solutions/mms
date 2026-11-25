import { getCurrentSubdomain } from "@mms/fe-core/config/tenantConfig";

/** True when the browser host is a madrasa subdomain (not platform apex). */
export function isBrowserOnTenantHost(): boolean {
  return getCurrentSubdomain() !== null;
}
