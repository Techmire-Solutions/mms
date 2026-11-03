import type { Contact } from "@mms/shared";
import type { ContactsRepository } from "../repository/contactsRepository.js";

type RelationshipOwner = Pick<Contact, "relationshipContacts"> | null | undefined;

/**
 * Normalized, de-duplicated ids of the contacts this contact links to.
 *
 * Shared by the single-write path (which must reconcile both the old and new
 * links) and the batch writers (which load the prior links before replacing
 * them). Keeping one helper avoids a second copy drifting from the write shape.
 */
export function collectRelatedContactIds(...contacts: RelationshipOwner[]): string[] {
  const ids = new Set<string>();
  for (const contact of contacts) {
    for (const entry of contact?.relationshipContacts ?? []) {
      if (entry?.contactId == null) continue;
      const id = String(entry.contactId).trim();
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

/**
 * Reads the relationship targets a batch is about to replace.
 *
 * Uses the summary projection (it already hydrates `relationshipContacts` with
 * six child queries instead of the full twelve). Adapters without the optional
 * summary method return no prior targets, which keeps test fakes working.
 */
export async function loadPreviousRelationshipTargets(
  repo: ContactsRepository,
  tenant: string,
  contactIds: string[],
): Promise<string[]> {
  if (contactIds.length === 0 || typeof repo.findSummaryByIds !== "function") return [];
  const previous = await repo.findSummaryByIds(tenant, contactIds);
  return collectRelatedContactIds(...previous);
}
