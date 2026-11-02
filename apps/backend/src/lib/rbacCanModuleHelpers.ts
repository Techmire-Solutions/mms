import type { User } from "@mms/shared";
import {
  CONTACTS_MODULE_MANIFEST,
  FACULTY_MODULE_MANIFEST,
  MESSAGING_MODULE_MANIFEST,
  STUDENTS_MODULE_MANIFEST,
  WORKSHOPS_MODULE_MANIFEST,
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

export function canRestoreMessagingLogs(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return roleHasPermission(user.role, MESSAGING_MODULE_MANIFEST.permissions.restoreLogs);
}

/**
 * Contacts picker access: the full contacts surface, or any module whose forms
 * embed a person-picker (student guardian, faculty contact, workshop
 * participant). Teachers/librarians hold those read grants without
 * `contacts.read`, so the picker must not reuse the contacts CRUD gate.
 */
export function canUseContactPicker(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return (
    canReadContacts(user) ||
    roleHasPermission(user.role, STUDENTS_MODULE_MANIFEST.permissions.read) ||
    roleHasPermission(user.role, FACULTY_MODULE_MANIFEST.permissions.read) ||
    roleHasPermission(user.role, WORKSHOPS_MODULE_MANIFEST.permissions.read)
  );
}
