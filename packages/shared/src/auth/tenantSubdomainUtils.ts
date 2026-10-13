/** Local dev apex when no env or hostname inference is available. */
export const LOCAL_DEV_APP_DOMAIN = "localhost";

export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "mail",
  "smtp",
  "ftp",
  "cdn",
  "static",
  "status",
  "help",
  "support",
  "billing",
  "dashboard",
  "login",
  "onboarding",
]);

export function slugifySubdomain(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Validate subdomain format and reserved names.
 */
export function isValidSubdomain(subdomain: string): boolean {
  if (!subdomain || subdomain.length < 2 || subdomain.length > 63) return false;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain)) return false;
  if (RESERVED_SUBDOMAINS.has(subdomain)) return false;
  return true;
}

/**
 * Extract tenant subdomain from hostname, or null for apex / unknown.
 */
export function parseTenantFromHost(hostname: string, appDomain: string): string | null {
  const host = hostname.toLowerCase().split(":")[0];

  if (
    host === appDomain ||
    host === `www.${appDomain}` ||
    (appDomain === "localhost" && (host === "127.0.0.1" || /^127\.\d+\.\d+\.\d+$/.test(host))) ||
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  ) {
    return null;
  }

  const suffix = `.${appDomain}`;
  if (host.endsWith(suffix)) {
    const sub = host.slice(0, -suffix.length);
    if (!sub || sub.includes(".")) return null;
    return isValidSubdomain(sub) ? sub : null;
  }

  // Local dev: {sub}.localhost
  if (appDomain === "localhost" && host.endsWith(".localhost")) {
    const sub = host.slice(0, -".localhost".length);
    if (!sub || sub.includes(".")) return null;
    return isValidSubdomain(sub) ? sub : null;
  }

  return null;
}

export function isApexHost(hostname: string, appDomain: string): boolean {
  return parseTenantFromHost(hostname, appDomain) === null;
}

/**
 * True when `hostname` is the configured MMS apex or a tenant under `appDomain`.
 * Used in production to reject Apache vhosts that incorrectly proxy other domains to MMS.
 */
export function isHostAllowedForAppDomain(hostname: string, appDomain: string): boolean {
  const host = hostname.toLowerCase().split(":")[0];
  if (host === "localhost" || host === "127.0.0.1") return true;
  const domain = appDomain.toLowerCase().trim();
  if (!domain || !host) return false;
  if (host === domain || host === `www.${domain}`) return true;
  return parseTenantFromHost(host, domain) !== null;
}
