import {
  LOCAL_DEV_APP_DOMAIN,
  isValidSubdomain,
  parseTenantFromHost,
} from "./tenantSubdomainUtils.js";

/**
 * Derive the apex app domain from a browser/API host when env is unset.
 * e.g. `{slug}.platform.example.com` → `platform.example.com`
 */
const APEX_3PART_LABELS = new Set(["platform", "mms", "mmsv2", "app", "staging", "dev", "www"]);

export function inferAppDomainFromHostname(hostname: string): string | null {
  const host = hostname.toLowerCase().split(":")[0];
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    /^127\.\d+\.\d+\.\d+$/.test(host)
  ) {
    return "localhost";
  }

  // IPv4 addresses are apex hosts, not domain hierarchies with subdomains
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return host;
  }

  if (host.startsWith("www.")) {
    const withoutWww = host.slice(4);
    const fromTenant = inferAppDomainFromHostname(withoutWww);
    return fromTenant ?? withoutWww;
  }

  const parts = host.split(".");
  if (parts.length < 3) {
    return null;
  }

  if (parts.length === 3) {
    const sub = parts[0];
    if (sub && APEX_3PART_LABELS.has(sub)) {
      return host;
    }
    const candidateApex = parts.slice(1).join(".");
    if (sub && isValidSubdomain(sub) && parseTenantFromHost(host, candidateApex) === sub) {
      return candidateApex;
    }
    return host;
  }

  const candidateApex = parts.slice(1).join(".");
  const sub = parts[0];
  if (sub && isValidSubdomain(sub) && parseTenantFromHost(host, candidateApex) === sub) {
    return candidateApex;
  }

  return null;
}

/** Configured domain wins; else infer from host; else localhost (dev only). */
export function resolveAppDomain(hostname: string, configuredDomain?: string | null): string {
  const trimmed = configuredDomain?.trim();
  if (trimmed) {
    return trimmed;
  }
  const inferred = inferAppDomainFromHostname(hostname);
  if (inferred) {
    return inferred;
  }
  return LOCAL_DEV_APP_DOMAIN;
}

/**
 * When `configuredAppDomain` is too short, a 3-part platform host can be misread as a tenant.
 * e.g. host `mmsv2.aabtaab.com` + config `aabtaab.com` → tenant `mmsv2` (wrong).
 */
export function misconfiguredAppDomainHint(
  hostname: string,
  configuredAppDomain: string,
): string | null {
  const host = hostname.toLowerCase().split(":")[0];
  const configured = configuredAppDomain.toLowerCase().trim();
  if (!configured || host === configured || host === `www.${configured}`) {
    return null;
  }

  const tenant = parseTenantFromHost(host, configured);
  if (!tenant) return null;

  const hostLabels = host.split(".");
  const configLabels = configured.split(".");
  if (hostLabels.length !== configLabels.length + 1 || !host.endsWith(`.${configured}`)) {
    return null;
  }

  // Real madrasa slugs under a correct apex are expected — not a misconfiguration.
  if (!APEX_3PART_LABELS.has(tenant)) {
    return null;
  }

  return (
    `MMS_APP_DOMAIN is "${configured}" but "${host}" is treated as tenant "${tenant}". ` +
    `Set MMS_APP_DOMAIN=${host}.`
  );
}

/**
 * Apex domain for the current request — self-corrects common MMS_APP_DOMAIN typos.
 */
export function resolveAppDomainForRequest(
  hostname: string,
  configuredDomain?: string | null,
): string {
  const host = hostname.toLowerCase().split(":")[0];
  const configured = configuredDomain?.trim();
  if (configured) {
    if (configured === LOCAL_DEV_APP_DOMAIN || configured.endsWith(`.${LOCAL_DEV_APP_DOMAIN}`)) {
      return resolveAppDomain(host, configured);
    }

    const hint = misconfiguredAppDomainHint(host, configured);
    if (hint && host.split(".").length === configured.split(".").length + 1) {
      return host;
    }

    // Configured apex is too short for multi-label tenants
    // (e.g. dar-ul-quran.mmsv2.example.com + example.com → no tenant parsed).
    if (
      parseTenantFromHost(host, configured) === null &&
      host !== configured &&
      host !== `www.${configured}`
    ) {
      const inferred = inferAppDomainFromHostname(host);
      if (inferred && inferred !== configured && parseTenantFromHost(host, inferred) !== null) {
        return inferred;
      }
    }
  }
  return resolveAppDomain(host, configured);
}
