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

export function requeueContactsSyncConflict(id: string): void {
  const conflicts = getContactsSyncConflicts();
  const entry = conflicts.find((conflict) => conflict.id === id);
  if (!entry) return;
  const { failedAt: _failedAt, ...outboxEntry } = entry;
  const queue = getContactsOutbox();
  queue.push(outboxEntry);
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
