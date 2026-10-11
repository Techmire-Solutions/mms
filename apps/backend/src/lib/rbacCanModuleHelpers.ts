import type { User } from "@mms/shared";
import {
  CONTACTS_MODULE_MANIFEST,
  MESSAGING_MODULE_MANIFEST,
  roleHasPermission,
} from "@mms/shared";

/** Contacts REST — aligned with `@mms/shared` permission matrix. */
export function canReadContacts(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return roleHasPermission(user.role, CONTACTS_MODULE_MANIFEST.permissions.read);
}

export function canWriteContacts(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return roleHasPermission(user.role, CONTACTS_MODULE_MANIFEST.permissions.write);
}

export function canDeleteContacts(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return roleHasPermission(user.role, CONTACTS_MODULE_MANIFEST.permissions.delete);
}

export function canReadMessaging(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return roleHasPermission(user.role, MESSAGING_MODULE_MANIFEST.permissions.read);
}

export function canWriteMessaging(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return roleHasPermission(user.role, MESSAGING_MODULE_MANIFEST.permissions.write);
}

export function canClearMessagingLogs(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return roleHasPermission(user.role, MESSAGING_MODULE_MANIFEST.permissions.clearLogs);
}
