import type { User } from "@mms/shared";
import { userHasPermission } from "./userPermissionContext.js";
import {
  ACCOUNTING_MODULE_MANIFEST,
  CONTACTS_MODULE_MANIFEST,
  FACULTY_MODULE_MANIFEST,
  FINANCE_MODULE_MANIFEST,
  MESSAGING_MODULE_MANIFEST,
  STUDENTS_MODULE_MANIFEST,
  WORKSHOPS_MODULE_MANIFEST,
} from "@mms/shared";

/** Contacts REST — aligned with `@mms/shared` permission matrix. */
export function canReadContacts(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return userHasPermission(user, CONTACTS_MODULE_MANIFEST.permissions.read);
}

export function canWriteContacts(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return userHasPermission(user, CONTACTS_MODULE_MANIFEST.permissions.write);
}

export function canDeleteContacts(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return userHasPermission(user, CONTACTS_MODULE_MANIFEST.permissions.delete);
}

export function canReadMessaging(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return userHasPermission(user, MESSAGING_MODULE_MANIFEST.permissions.read);
}

export function canWriteMessaging(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return userHasPermission(user, MESSAGING_MODULE_MANIFEST.permissions.write);
}

export function canClearMessagingLogs(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return userHasPermission(user, MESSAGING_MODULE_MANIFEST.permissions.clearLogs);
}

export function canRestoreMessagingLogs(user: User): boolean {
  if (!user || !user.role) {
    return false;
  }
  return userHasPermission(user, MESSAGING_MODULE_MANIFEST.permissions.restoreLogs);
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
    userHasPermission(user, STUDENTS_MODULE_MANIFEST.permissions.read) ||
    userHasPermission(user, FACULTY_MODULE_MANIFEST.permissions.read) ||
    userHasPermission(user, WORKSHOPS_MODULE_MANIFEST.permissions.read)
  );
}

/**
 * Privileged billing authority: invoice cancel/void, credit notes (the fee-waiver
 * path), fee structures and bulk status. Ordinary `finance.write` records
 * payments and drafts; it must not be able to waive or erase a recognised charge.
 */
export function canManageFinance(user: User): boolean {
  if (!user || !user.role) return false;
  return userHasPermission(user, FINANCE_MODULE_MANIFEST.permissions.manage);
}

/**
 * Privileged accounting authority: period close/reopen, fiscal-year close and
 * voucher-numbering configuration. Ordinary `accounting.write` posts vouchers and
 * runs revaluations.
 */
export function canManageAccounting(user: User): boolean {
  if (!user || !user.role) return false;
  return userHasPermission(user, ACCOUNTING_MODULE_MANIFEST.permissions.manage);
}
