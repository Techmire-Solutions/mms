import type { Contact } from "@mms/shared";
import { AUTH_USER_STORAGE_KEY, readUserIdFromStoredAuth } from "@/lib/contexts/authContextHelpers";
import { getWorkspaceLocalStoragePrefix } from "@/lib/dbStorageCore";
import {
  contactsOutboxStorageKeys,
  type ContactsOutboxStorageKeys,
} from "@/lib/contacts/contactsOutboxKeys";

export type ContactsOutboxEntry =
  | { id: string; kind: "upsert"; contact: Contact; createdAt: string }
  | { id: string; kind: "update"; contactId: string; contact: Contact; createdAt: string }
  | { id: string; kind: "delete"; contactId: string; deletionReason?: string; createdAt: string };

export type ContactsSyncConflict = ContactsOutboxEntry & { failedAt: string };

/**
 * Keys for the current workspace + signed-in user. The queue is PII, so it is
 * never shared across users on the same device.
 */
export function currentContactsSyncKeys(): ContactsOutboxStorageKeys {
  if (typeof window === "undefined") return contactsOutboxStorageKeys("mms_");
  const userId = readUserIdFromStoredAuth(localStorage.getItem(AUTH_USER_STORAGE_KEY));
  return contactsOutboxStorageKeys(getWorkspaceLocalStoragePrefix(), userId);
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function notifyContactsSyncOutboxChanged(): void {
  window.dispatchEvent(new CustomEvent("contacts-sync-outbox-changed"));
}

export function getContactsOutbox(): ContactsOutboxEntry[] {
  return readJson<ContactsOutboxEntry[]>(currentContactsSyncKeys().outbox, []);
}

export function getContactsSyncConflicts(): ContactsSyncConflict[] {
  return readJson<ContactsSyncConflict[]>(currentContactsSyncKeys().conflicts, []);
}
