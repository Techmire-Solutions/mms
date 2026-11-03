import type { Contact } from "@mms/shared";
import { AUTH_USER_STORAGE_KEY, readUserIdFromStoredAuth } from "@/lib/contexts/authContextHelpers";
import { getWorkspaceLocalStoragePrefix } from "@/lib/dbStorageCore";
import {
  contactsOutboxStorageKeys,
  type ContactsOutboxStorageKeys,
} from "@/lib/contacts/contactsOutboxKeys";

interface ContactsOutboxEntryBase {
  id: string;
  createdAt: string;
  /**
   * Replay attempts after a conflict. "Keep local"/"Retry all" re-queue the entry,
   * so an unresolvable payload must stop looping instead of minting a new conflict
   * on every flush (R4-08).
   */
  attempts?: number;
}

export type ContactsOutboxEntry = ContactsOutboxEntryBase &
  (
    | { kind: "upsert"; contact: Contact }
    | { kind: "update"; contactId: string; contact: Contact }
    | { kind: "delete"; contactId: string; deletionReason?: string }
  );

export type ContactsSyncConflict = ContactsOutboxEntry & { failedAt: string };

/** Re-queue budget for one conflicted entry before it is reported as permanent. */
export const MAX_CONTACTS_SYNC_CONFLICT_ATTEMPTS = 3;

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
