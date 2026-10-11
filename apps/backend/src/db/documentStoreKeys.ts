import {
  PLATFORM_SUPER_USERS_OBJECT_KEY,
  WORKSPACES_COLLECTION,
  tenantCollectionKey,
  tenantObjectKey,
} from "@mms/shared";
import { getRequestTenant } from "../lib/tenantContext.js";

export function resolveCollectionStorageName(name: string): string {
  const tenant = getRequestTenant();
  if (!tenant || name === WORKSPACES_COLLECTION) return name;
  return tenantCollectionKey(tenant, name);
}

export function resolveObjectStorageKey(key: string): string {
  const tenant = getRequestTenant();
  if (!tenant || key === PLATFORM_SUPER_USERS_OBJECT_KEY) return key;
  return tenantObjectKey(tenant, key);
}

export function getQueryRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}
