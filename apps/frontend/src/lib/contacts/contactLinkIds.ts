import type { Contact } from "@mms/shared";

/** Collect linked contact ids from relationshipContacts and legacy relationships. */
export function collectLinkedContactIds(contacts: readonly Contact[]): string[] {
  const ids = new Set<string>();
  for (const contact of contacts) {
    for (const ec of contact.relationshipContacts ?? []) {
      if (ec.contactId != null && String(ec.contactId).length > 0) {
        ids.add(String(ec.contactId));
      }
    }
    for (const rel of contact.relationships ?? []) {
      if (rel.contactId != null && String(rel.contactId).length > 0) {
        ids.add(String(rel.contactId));
      }
    }
  }
  return [...ids];
}

/** Merge visible rows with batch-resolved link targets (deduped by id). */
export function mergeContactLinkDirectory(
  primary: readonly Contact[],
  resolved: readonly Contact[],
): Contact[] {
  const byId = new Map<string, Contact>();
  for (const row of primary) byId.set(String(row.id), row);
  for (const row of resolved) {
    if (!byId.has(String(row.id))) byId.set(String(row.id), row);
  }
  return [...byId.values()];
}
