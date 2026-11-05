import { uuidv7, type Contact } from "@mms/shared";
import {
  MAX_CONTACTS_SYNC_CONFLICT_ATTEMPTS,
  currentContactsSyncKeys,
  getContactsOutbox,
  notifyContactsSyncOutboxChanged,
  writeJson,
  type ContactsOutboxEntry,
} from "@/lib/contacts/contactsSyncOutboxStorage";
import { recordContactsSyncConflict } from "@/lib/contacts/contactsSyncOutboxConflicts";

type ContactsOutboxInput =
  | { kind: "upsert"; contact: Contact; id?: string }
  | { kind: "update"; contactId: string; contact: Contact; id?: string }
  | { kind: "delete"; contactId: string; deletionReason?: string; id?: string };

export function enqueueContactsOutbox(entry: ContactsOutboxInput): void {
  const queue = getContactsOutbox();
  const full = {
    ...entry,
    id: entry.id ?? uuidv7(),
    createdAt: new Date().toISOString(),
  } as ContactsOutboxEntry;
  queue.push(full);
  writeJson(currentContactsSyncKeys().outbox, queue);
  notifyContactsSyncOutboxChanged();
}

function removeOutboxEntry(id: string): void {
  writeJson(
    currentContactsSyncKeys().outbox,
    getContactsOutbox().filter((outboxEntry) => outboxEntry.id !== id),
  );
  notifyContactsSyncOutboxChanged();
}

interface ContactsOutboxFlushHandlers {
  upsert: (contact: Contact) => Promise<unknown>;
  update: (contactId: string, contact: Contact) => Promise<unknown>;
  delete: (contactId: string, deletionReason?: string) => Promise<unknown>;
}

export interface ContactsOutboxFlushResult {
  /** True when this caller attached to an in-flight flush (the owner already notifies). */
  joined?: boolean;
  /** Entries replayed successfully (a delete replay that 404s counts here — already archived). */
  synced: number;
  /** Entries moved to the conflict queue (non-retryable client errors). */
  failed: number;
  /** Alias of `failed`, kept for the conflict UI. */
  conflicts: number;
  /** Entries left queued because the server was unreachable or 5xx; retried later. */
  retryable: number;
}

/** HTTP status carried by an `ApiError` or by a ts-rest response object. */
function readErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

/**
 * Whether a failed replay should stay queued.
 *
 * Transport failures (fetch rejects, no status) and 5xx/429 mean the server did not
 * decide anything — converting those into "conflicts" would strand the whole queue
 * behind manual review during a deploy or a flaky connection.
 */
export function isRetryableContactsOutboxError(error: unknown): boolean {
  const status = readErrorStatus(error);
  if (status === undefined) return true;
  if (status === 408 || status === 425 || status === 429) return true;
  return status >= 500;
}

/** A delete whose row is already archived is an idempotent success, not a conflict. */
function isAlreadyArchivedDelete(entry: ContactsOutboxEntry, error: unknown): boolean {
  return entry.kind === "delete" && readErrorStatus(error) === 404;
}

/**
 * Single-flight guard: `useContactsSyncOutbox` is mounted by the metrics header,
 * the offline banner and the conflict panel, each with its own `online`
 * listener. Without this guard a single reconnect replays the same queue three
 * times (duplicate writes, duplicate conflict rows).
 */
let inFlightFlush: Promise<ContactsOutboxFlushResult> | null = null;

/** Replays queued mutations when back online (globle1 §1.4). */
export function flushContactsOutbox(
  handlers: ContactsOutboxFlushHandlers,
): Promise<ContactsOutboxFlushResult> {
  if (inFlightFlush) {
    // Joined callers must not re-notify or re-invalidate; mark the shared result.
    return inFlightFlush.then((result) => ({ ...result, joined: true }));
  }
  inFlightFlush = runFlush(handlers).finally(() => {
    inFlightFlush = null;
  });
  return inFlightFlush;
}

async function runFlush(handlers: ContactsOutboxFlushHandlers): Promise<ContactsOutboxFlushResult> {
  const queue = [...getContactsOutbox()];
  let synced = 0;
  let failed = 0;
  let conflicts = 0;
  let retryable = 0;

  for (const entry of queue) {
    if ((entry.attempts ?? 0) >= MAX_CONTACTS_SYNC_CONFLICT_ATTEMPTS) {
      // Resolved conflicts are re-queued with an incremented `attempts`; replaying
      // an entry the user already exhausted only mints another conflict.
      removeOutboxEntry(entry.id);
      recordContactsSyncConflict(entry);
      failed += 1;
      conflicts += 1;
      continue;
    }

    try {
      if (entry.kind === "upsert") {
        await handlers.upsert(entry.contact);
      } else if (entry.kind === "update") {
        await handlers.update(entry.contactId, entry.contact);
      } else {
        await handlers.delete(entry.contactId, entry.deletionReason);
      }
      removeOutboxEntry(entry.id);
      synced += 1;
    } catch (error) {
      if (isAlreadyArchivedDelete(entry, error)) {
        removeOutboxEntry(entry.id);
        synced += 1;
        continue;
      }
      if (isRetryableContactsOutboxError(error)) {
        // Stop here: the server is unreachable/overloaded, so the remaining entries
        // would fail identically. They stay queued for the next flush.
        retryable += 1;
        break;
      }
      removeOutboxEntry(entry.id);
      recordContactsSyncConflict(entry);
      failed += 1;
      conflicts += 1;
    }
  }

  if (synced > 0 || conflicts > 0) {
    notifyContactsSyncOutboxChanged();
  }

  return { synced, failed, conflicts, retryable };
}

/** Test-only reset for the single-flight guard. */
export function resetContactsOutboxFlushForTests(): void {
  inFlightFlush = null;
}
