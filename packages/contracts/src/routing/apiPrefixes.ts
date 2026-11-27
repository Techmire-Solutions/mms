/**
 * @file apiPrefixes.ts
 * @description Canonical + legacy REST prefixes for module-owned routes.
 */

export interface ModuleRoutePrefixes {
  readonly canonical: string;
  readonly legacy: string;
}

/** Derive both mount prefixes for a module from its manifest `restBasePath`. */
export function moduleRoutePrefixes(restBasePath: string): ModuleRoutePrefixes {
  const segment = stripInternalPrefix(restBasePath);
  return { canonical: `/api/tenant/${segment}`, legacy: `/api/${segment}` };
}

/** Normalise `/api/v1/tenant/<m>`, `/api/v1/<m>`, `/api/tenant/<m>`, `/api/<m>` to `<m>`. */
export function stripInternalPrefix(restBasePath: string): string {
  return restBasePath
    .replace(/^\/api\/v\d+\/tenant\//, "")
    .replace(/^\/api\/v\d+\//, "")
    .replace(/^\/api\/tenant\//, "")
    .replace(/^\/api\//, "")
    .replace(/^\/+|\/+$/g, "");
}

export const LEGACY_DEPRECATION_HEADER = "Deprecation";
export const LEGACY_SUNSET_HEADER = "Sunset";
export const LEGACY_MOUNT_SUNSET = "Wed, 31 Dec 2026 23:59:59 GMT";

/**
 * Rewrite a legacy module URL to its canonical tenant URL.
 * `/api/students/x` -> `/api/tenant/students/x`
 */
export function toCanonicalUrl(url: string, restBasePath: string): string | undefined {
  const { canonical, legacy } = moduleRoutePrefixes(restBasePath);
  if (url === legacy || url === `${legacy}/`) return canonical;
  if (url.startsWith(`${legacy}/`)) return canonical + url.slice(legacy.length);
  return undefined;
}

/**
 * Strip the canonical `/api/tenant/<m>` namespace back to the legacy `/api/<m>`
 * path. Action rules, route inventories and audit keys are written against the
 * legacy shape, so both mounts classify identically.
 */
export function toLegacyApiUrl(url: string): string {
  return url.startsWith("/api/tenant/") ? `/api/${url.slice("/api/tenant/".length)}` : url;
}
