import { CONTACT_TAB_COLLECTION_KEYS, type Contact, type ValidationError } from "@mms/shared";

/** Snapshot of the server-reported field errors and the draft they were reported for. */
export interface ContactServerErrorSnapshot {
  errors: ValidationError[];
  draft: Partial<Contact>;
}

function errorKey(error: ValidationError): string {
  return `${error.tabId}|${error.fieldId}|${error.index ?? ""}`;
}

function readRecordValue(record: unknown, key: string): unknown {
  if (!record || typeof record !== "object") return undefined;
  return (record as Record<string, unknown>)[key];
}

/**
 * The draft value an error points at, serialised for comparison. Row errors read
 * `collection[index][fieldId]` (tab → property via `CONTACT_TAB_COLLECTION_KEYS`,
 * custom collection tabs store rows under the tab id); scalar errors read the
 * top-level field or the matching custom field.
 */
export function readContactErrorFieldValue(
  draft: Partial<Contact>,
  error: ValidationError,
): string {
  if (error.index !== undefined) {
    const collectionKey = CONTACT_TAB_COLLECTION_KEYS[error.tabId]?.[0] ?? error.tabId;
    const rows = readRecordValue(draft, String(collectionKey));
    const row = Array.isArray(rows) ? rows[error.index] : undefined;
    return JSON.stringify(readRecordValue(row, error.fieldId) ?? null);
  }
  const scalar =
    readRecordValue(draft, error.fieldId) ??
    readRecordValue(readRecordValue(draft, "customFields"), error.fieldId);
  return JSON.stringify(scalar ?? null);
}

/**
 * Drops the shown errors the user has fixed, without adding new ones while they type.
 *
 * - A client-side error stays only while the current draft still produces it.
 * - A server-side error (e.g. a unique value already used by another contact)
 *   stays only while its field still holds the value that was rejected.
 *
 * Returns `current` itself when nothing changed so callers can skip a state update.
 */
export function reconcileContactValidationErrors({
  current,
  clientErrors,
  server,
  draft,
}: {
  current: ValidationError[];
  clientErrors: ValidationError[];
  server: ContactServerErrorSnapshot | null;
  draft: Partial<Contact>;
}): ValidationError[] {
  if (current.length === 0) return current;
  const stillFailing = new Set(clientErrors.map(errorKey));
  const serverKeys = new Set((server?.errors ?? []).map(errorKey));
  const next = current.filter((error) => {
    const key = errorKey(error);
    if (server && serverKeys.has(key)) {
      return (
        readContactErrorFieldValue(draft, error) === readContactErrorFieldValue(server.draft, error)
      );
    }
    return stillFailing.has(key);
  });
  return next.length === current.length ? current : next;
}
