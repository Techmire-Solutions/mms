import type { User } from "@mms/shared";
import { PLATFORM_SUPER_USERS_OBJECT_KEY } from "@mms/shared";
import {
  OBJECT_READ_PERMISSION,
  OBJECT_WRITE_PERMISSION,
  WRITE_ROLES,
  isAllowedObjectKey,
  isStaffWriteObjectKey,
} from "./rbacPermissionMaps.js";
import { userHasPermission } from "./userPermissionContext.js";

function computeCanReadObject(user: User, key: string): boolean {
  if (!user || !user.role) {
    return false;
  }
  if (key === PLATFORM_SUPER_USERS_OBJECT_KEY) {
    return false;
  }
  if (!isAllowedObjectKey(key)) {
    return false;
  }
  const mapped = OBJECT_READ_PERMISSION[key];
  if (mapped) {
    return userHasPermission(user, mapped);
  }
  if (isStaffWriteObjectKey(key)) {
    return WRITE_ROLES.has(user.role);
  }
  // Allowed but unmapped and not an explicit staff key — deny (fail closed).
  return false;
}

/**
 * Returns true if the user may read the given KV object.
 * Email integration settings are admin-only; other staff objects follow workspace roles.
 */
export function canReadObject(user: User, key: string): boolean {
  if (!user || !user.role) {
    return false;
  }
  const result = computeCanReadObject(user, key);
  return result;
}

function computeCanWriteObject(user: User, key: string): boolean {
  if (!user || !user.role) {
    return false;
  }
  if (key === PLATFORM_SUPER_USERS_OBJECT_KEY) {
    return false;
  }
  // Legacy document-store key for module grants (now on workspaces.granted_modules).
  // Tenants must never write this key even if a leftover objects row exists.
  if (key === "platform_settings") {
    return false;
  }
  if (!isAllowedObjectKey(key)) {
    return false;
  }
  const mapped = OBJECT_WRITE_PERMISSION[key];
  if (mapped) {
    return userHasPermission(user, mapped);
  }
  if (isStaffWriteObjectKey(key)) {
    return WRITE_ROLES.has(user.role);
  }
  // Allowed but unmapped and not an explicit staff key — deny (fail closed).
  return false;
}

/**
 * Returns true if the user may write the given KV object.
 */
export function canWriteObject(user: User, key: string): boolean {
  if (!user || !user.role) {
    return false;
  }
  const result = computeCanWriteObject(user, key);
  return result;
}

/** Bulk sync upload — same privilege as settings.global.write (admin today). */
export function canBulkSync(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return userHasPermission(user, "settings.global.write");
}

/** Bulk sync download — same privilege as canBulkSync / settings.global.write. */
export function canDownloadBulkSync(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return canBulkSync(user);
}

/** Tenant reset — same privilege as canBulkSync / settings.global.write. */
export function canResetTenantData(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return canBulkSync(user);
}
