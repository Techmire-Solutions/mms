import {
  buildApexUrl,
  buildTenantUrl,
  isApexHost,
  resolveAppDomainForRequest,
  type TenantUrlOptions,
  parseTenantFromHost,
} from "@mms/shared/tenantUtils";
import { env } from "@/lib/config/env";

/** Apex domain for this deployment (localhost in dev, platform domain in prod). */
export function getAppDomain(): string {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  return resolveAppDomainForRequest(hostname, env.appDomain);
}

export function getTenantUrlOptions(): TenantUrlOptions {
  if (typeof window === "undefined") {
    return { appDomain: getAppDomain() };
  }
  return {
    appDomain: getAppDomain(),
    protocol: window.location.protocol,
    port: getAppDomain() === "localhost" ? window.location.port : null,
  };
}

export function tenantUrl(subdomain: string, path = "/"): string {
  return buildTenantUrl(subdomain, path, getTenantUrlOptions());
}

export function apexUrl(path = "/"): string {
  return buildApexUrl(path, getTenantUrlOptions());
}

/** True when the current browser host is the apex domain (no tenant subdomain). */
export function isCurrentHostApex(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return isApexHost(window.location.hostname.toLowerCase(), getAppDomain());
}

/** True when the hostname is a tenant workspace (`{subdomain}.localhost` or `{subdomain}.{platform-domain}`). */
export function isTenantHost(): boolean {
  if (typeof window === "undefined") return false;
  return !isCurrentHostApex();
}

/** Resolves the active tenant subdomain from the current browser hostname. */
export function getCurrentSubdomain(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return parseTenantFromHost(window.location.hostname, getAppDomain());
}
