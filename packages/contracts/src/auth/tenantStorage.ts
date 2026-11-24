/** Global registry collection — not tenant-prefixed. */
export const WORKSPACES_COLLECTION = "workspaces";

/** Builds a tenant-scoped collection key in PostgreSQL / localStorage. */
export function tenantCollectionKey(subdomain: string, name: string): string {
  return `t:${subdomain}:${name}`;
}

/** Builds a tenant-scoped singleton object key. */
export function tenantObjectKey(subdomain: string, key: string): string {
  return `t:${subdomain}:${key}`;
}

/** Whether a storage key is tenant-scoped. */
function isTenantScopedStorageKey(key: string): boolean {
  return key.startsWith("t:") && key.split(":").length >= 3;
}

/**
 * Parses `t:{subdomain}:{rest}` into subdomain and logical name/key.
 * Returns null for global keys (e.g. `workspaces`).
 */
export function parseTenantScopedStorageKey(
  key: string,
): { subdomain: string; logicalKey: string } | null {
  if (!isTenantScopedStorageKey(key)) return null;
  const parts = key.split(":");
  const subdomain = parts[1];
  const logicalKey = parts.slice(2).join(":");
  if (!subdomain || !logicalKey) return null;
  return { subdomain, logicalKey };
}

/** Prefix for browser localStorage keys on a tenant host. */
export function tenantLocalStoragePrefix(subdomain: string): string {
  return `mms_t:${subdomain}:`;
}
