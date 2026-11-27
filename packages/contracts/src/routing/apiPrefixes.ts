/**
 * @file apiPrefixes.ts
 * @description Canonical + legacy REST prefixes for module-owned routes.
 *
 * P7 of the monorepo migration: every module's routes are mounted twice while
 * the legacy contract is still supported — `canonical` (`/api/tenant/<m>`) and
 * `legacy` (`/api/<m>`). The legacy mount carries `Deprecation` + `Sunset`.
 */

export interface ModuleRoutePrefixes {
  /** Canonical, tenant-scoped prefix. */
  readonly canonical: string;
  /** Backwards-compatible prefix (retired in P9). */
  readonly legacy: string;
}

/**
 * Derive both prefixes for a module from its manifest `restBasePath`.
 *
 * `restBasePath` is the historical `/api/<segment>` shape. We normalise any
 * internal `/api/v1/tenant/...` form and then emit both mount points.
 */
export function moduleRoutePrefixes(restBasePath: string): ModuleRoutePrefixes {
  const segment = stripInternalPrefix(restBasePath);
  return {
    canonical: `/api/tenant/${segment}`,
    legacy: `/api/${segment}`,
  };
}

/**
 * Normalise a contract path that still declares an internal prefix
 * (`/api/v1/tenant/<m>`, `/api/v1/<m>`, `/api/tenant/<m>`, `/api/<m>`)
 * down to the bare module segment.
 */
export function stripInternalPrefix(restBasePath: string): string {
  return restBasePath
    .replace(/^\/api\/v\d+\/tenant\//, "")
    .replace(/^\/api\/v\d+\//, "")
    .replace(/^\/api\/tenant\//, "")
    .replace(/^\/api\//, "")
    .replace(/^\/+|\/+$/g, "");
}

/** Header names emitted on the legacy mounts. */
export const LEGACY_DEPRECATION_HEADER = "Deprecation";
export const LEGACY_SUNSET_HEADER = "Sunset";

/**
 * The RFC 9745 `Sunset` value used for the legacy module mounts.
 * Kept in one place so the dual-mount test and the runtime agree.
 */
export const LEGACY_MOUNT_SUNSET = "Wed, 31 Dec 2026 23:59:59 GMT";
