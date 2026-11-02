import type { Contact } from "@mms/shared";
import {
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
    id: entry.id ?? crypto.randomUUID(),
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
  synced: number;
  failed: number;
  conflicts: number;
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
  if (inFlightFlush) return inFlightFlush;
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

  for (const entry of queue) {
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
    } catch {
      removeOutboxEntry(entry.id);
      recordContactsSyncConflict(entry);
      failed += 1;
      conflicts += 1;
    }
  }

  if (synced > 0 || conflicts > 0) {
    notifyContactsSyncOutboxChanged();
  }

  return { synced, failed, conflicts };
}

/** Test-only reset for the single-flight guard. */
export function resetContactsOutboxFlushForTests(): void {
  inFlightFlush = null;
}
