import { LOCAL_DEV_APP_DOMAIN } from "./tenantSubdomainUtils.js";
import { parseTenantFromHost } from "./tenantSubdomainUtils.js";

/**
 * True for local dev origins only. Production CORS should use `isOriginAllowedForAppDomain`
 * with `MMS_APP_DOMAIN` from the environment.
 */
export function isTrustedWorkspaceOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === LOCAL_DEV_APP_DOMAIN ||
      host.endsWith(".localhost") ||
      host === "127.0.0.1" ||
      /^127\.\d+\.\d+\.\d+$/.test(host)
    );
  } catch {
    return false;
  }
}

/**
 * True when `origin` is the apex or a tenant workspace for `appDomain`.
 */
export function isOriginAllowedForAppDomain(origin: string, appDomain: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === appDomain || host === `www.${appDomain}`) {
      return true;
    }
    return parseTenantFromHost(host, appDomain) !== null;
  } catch {
    return false;
  }
}
