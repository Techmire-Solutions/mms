import { CONTACTS_IMPORT_MAX_BATCH } from "@mms/shared";

/**
 * Splits a parsed contact list into import batches.
 *
 * One `POST /api/contacts/import` job carries at most `CONTACTS_IMPORT_MAX_BATCH` contacts
 * (server-side body/schema cap), so a large vCard becomes a few jobs rather than one request
 * per contact.
 */
export function chunkContactsForImport<T>(
  contacts: readonly T[],
  batchSize: number = CONTACTS_IMPORT_MAX_BATCH,
): T[][] {
  const size = Math.max(1, Math.floor(batchSize));
  const batches: T[][] = [];
  for (let index = 0; index < contacts.length; index += size) {
    batches.push(contacts.slice(index, index + size) as T[]);
  }
  return batches;
}
