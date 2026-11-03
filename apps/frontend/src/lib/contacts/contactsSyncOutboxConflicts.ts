import type { Contact } from "@mms/shared";
import {
  currentContactsSyncKeys,
  getContactsOutbox,
  getContactsSyncConflicts,
  notifyContactsSyncOutboxChanged,
  writeJson,
  type ContactsOutboxEntry,
  type ContactsSyncConflict,
} from "@/lib/contacts/contactsSyncOutboxStorage";

export function clearContactsSyncConflicts(): void {
  writeJson(currentContactsSyncKeys().conflicts, []);
  notifyContactsSyncOutboxChanged();
}

export function dismissContactsSyncConflict(id: string): void {
  writeJson(
    currentContactsSyncKeys().conflicts,
    getContactsSyncConflicts().filter((conflict) => conflict.id !== id),
  );
  notifyContactsSyncOutboxChanged();
}

/**
 * Re-queues a conflicted entry.
 *
 * A conflict caused by a stale optimistic-concurrency token can never resolve by
 * replaying the same payload, so the caller passes the local values rebased onto
 * the current server record (`rebasedContact` carries the fresh `updatedAt`).
 * Each re-queue increments `attempts`; after `MAX_CONTACTS_SYNC_CONFLICT_ATTEMPTS`
 * the caller stops and reports a permanent failure (R4-08).
 */
export function requeueContactsSyncConflict(id: string, rebasedContact?: Contact): void {
  const conflicts = getContactsSyncConflicts();
  const entry = conflicts.find((conflict) => conflict.id === id);
  if (!entry) return;
  const { failedAt: _failedAt, ...outboxEntry } = entry;
  const attempts = (entry.attempts ?? 0) + 1;
  const withContact =
    rebasedContact && (outboxEntry.kind === "upsert" || outboxEntry.kind === "update")
      ? { ...outboxEntry, contact: rebasedContact }
      : outboxEntry;
  const queue = getContactsOutbox();
  queue.push({ ...withContact, attempts } as ContactsOutboxEntry);
  writeJson(currentContactsSyncKeys().outbox, queue);
  dismissContactsSyncConflict(id);
}

export function requeueAllContactsSyncConflicts(): number {
  const conflicts = [...getContactsSyncConflicts()];
  for (const entry of conflicts) {
    requeueContactsSyncConflict(entry.id);
  }
  return conflicts.length;
}

export function recordContactsSyncConflict(entry: ContactsOutboxEntry): void {
  const conflicts: ContactsSyncConflict[] = getContactsSyncConflicts();
  conflicts.push({ ...entry, failedAt: new Date().toISOString() });
  writeJson(currentContactsSyncKeys().conflicts, conflicts);
}
