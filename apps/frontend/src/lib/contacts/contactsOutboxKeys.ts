/**
 * Storage keys for the Contacts offline outbox.
 *
 * The queue holds full contact payloads (phones, CNIC, bank details), so it must
 * be scoped to both the workspace **and** the signed-in user: a shared device
 * must never replay one user's queued writes into another user's session, and
 * `clearUserScopedCachesOnLogout` must be able to remove it.
 *
 * Pure module — no imports — so both the storage layer and the auth logout path
 * can depend on it without a cycle.
 */
export interface ContactsOutboxStorageKeys {
  outbox: string;
  conflicts: string;
}

export function contactsOutboxStorageKeys(
  prefix: string,
  userId?: string,
): ContactsOutboxStorageKeys {
  const scope = userId ? `_u:${userId}` : "";
  return {
    outbox: `${prefix}contacts_sync_outbox${scope}`,
    conflicts: `${prefix}contacts_sync_conflicts${scope}`,
  };
}
