import type { Contact } from "@mms/shared";
import {
  MAX_CONTACTS_SYNC_CONFLICT_ATTEMPTS,
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

export interface RequeueAllResult {
  requeued: number;
  /** Entries at the attempt cap (or with no server record to rebase onto) left untouched. */
  skipped: number;
  /** Entries with newer server changes left for per-row review (never bulk-overwritten). */
  needsReview: number;
}

export interface RequeueAllOptions {
  /**
   * Loads the current server contact so a stale-token conflict is rebased before
   * replay. Without it, "Retry all" would replay the same 409 forever.
   */
  fetchFresh?: (contactId: string) => Promise<Contact | null | undefined>;
  maxAttempts?: number;
}

/**
 * Re-queues every resolvable conflict.
 *
 * Unlike the per-row action, this path must be safe to run on a mixed queue:
 * entries that already exhausted their retry budget are skipped, and each
 * stale-token entry is rebased onto the current server record before it is
 * queued again.
 */
export async function requeueAllContactsSyncConflicts(
  options: RequeueAllOptions = {},
): Promise<RequeueAllResult> {
  const maxAttempts = options.maxAttempts ?? MAX_CONTACTS_SYNC_CONFLICT_ATTEMPTS;
  const conflicts = [...getContactsSyncConflicts()];
  let requeued = 0;
  let skipped = 0;
  let needsReview = 0;

  for (const entry of conflicts) {
    if ((entry.attempts ?? 0) >= maxAttempts) {
      skipped += 1;
      continue;
    }

    let rebasedContact: Contact | undefined;
    if (options.fetchFresh && (entry.kind === "upsert" || entry.kind === "update")) {
      const contactId = String(entry.contact.id);
      const fresh = await options.fetchFresh(contactId).catch(() => null);
      if (!fresh) {
        // No fresh token: replaying the stale payload would 409 again and burn an
        // attempt, so leave it in the conflict list.
        skipped += 1;
        continue;
      }
      // Any server edit bumps `updatedAt`. Comparing the version token catches
      // changes to notes/attachments too, which the narrow sync-diff field list
      // would miss; "Retry all" must never silently overwrite them.
      const localUpdatedAt = entry.contact.updatedAt;
      if (!localUpdatedAt || !fresh.updatedAt || fresh.updatedAt !== localUpdatedAt) {
        needsReview += 1;
        continue;
      }
      const { _blueprintId: _staleBlueprint, ...localFields } = entry.contact as Contact & {
        _blueprintId?: string;
      };
      rebasedContact = { ...localFields, updatedAt: fresh.updatedAt } as Contact;
    }

    requeueContactsSyncConflict(entry.id, rebasedContact);
    requeued += 1;
  }

  return { requeued, skipped, needsReview };
}

export function recordContactsSyncConflict(entry: ContactsOutboxEntry): void {
  const conflicts: ContactsSyncConflict[] = getContactsSyncConflicts();
  conflicts.push({ ...entry, failedAt: new Date().toISOString() });
  writeJson(currentContactsSyncKeys().conflicts, conflicts);
}
