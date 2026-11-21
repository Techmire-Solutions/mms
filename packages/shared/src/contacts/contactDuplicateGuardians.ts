import type { Contact } from "./contactTypes.js";
import { normalizeRelationshipTerm } from "./contactRelationshipPairUtils.js";

/**
 * Relationship labels that describe the *linked* contact as the owner's parent or
 * guardian (a student's row `{ contactId: P, relationship: "Guardian" }` means P
 * is the guardian). Lower-case, compared after `normalizeRelationshipTerm`.
 *
 * Shared by the JS pair finder and the backend SQL guardian lookup so the two
 * cannot drift.
 */
export const CONTACT_GUARDIAN_RELATIONSHIP_TERMS = [
  "parent",
  "father",
  "mother",
  "guardian",
] as const;

/**
 * Relationship labels that describe the *linked* contact as the owner's child or
 * dependent — i.e. the owner is a parent/guardian.
 */
export const CONTACT_DEPENDENT_RELATIONSHIP_TERMS = [
  "child",
  "son",
  "daughter",
  "dependent",
  "ward",
] as const;

const GUARDIAN_TERMS: ReadonlySet<string> = new Set(CONTACT_GUARDIAN_RELATIONSHIP_TERMS);
const DEPENDENT_TERMS: ReadonlySet<string> = new Set(CONTACT_DEPENDENT_RELATIONSHIP_TERMS);

/**
 * Ids of contacts that act as a parent/guardian of some child, derived from the
 * relationship rows of the given contacts:
 * - a contact whose own rows link a child/dependent is a guardian;
 * - a contact linked by another contact's parent/guardian row is a guardian.
 *
 * The backend adds guardians it can only see in SQL (links from contacts outside
 * the pool, `students.*_contact_id`) through `extraGuardianIds`.
 */
export function collectContactGuardianIds(
  contacts: ReadonlyArray<Contact>,
  extraGuardianIds: Iterable<string | number> = [],
): Set<string> {
  const ids = new Set<string>();
  for (const id of extraGuardianIds) {
    const trimmed = String(id).trim();
    if (trimmed) ids.add(trimmed);
  }
  for (const contact of contacts) {
    for (const link of contact.relationshipContacts ?? []) {
      if (link?.contactId == null) continue;
      const term = normalizeRelationshipTerm(link.relationship);
      if (DEPENDENT_TERMS.has(term) && contact.id != null) ids.add(String(contact.id));
      if (GUARDIAN_TERMS.has(term)) ids.add(String(link.contactId).trim());
    }
  }
  return ids;
}

/**
 * Two guardians sharing only a name are not flagged: one parent with several
 * children (e.g. one guardian contact per admission) must not show up as a
 * duplicate of itself. Any phone/email/CNIC match is still reported.
 */
export function isGuardianNameOnlyPair(
  pair: { reasonKey: string; contacts: ReadonlyArray<Contact> },
  guardianIds: ReadonlySet<string>,
): boolean {
  if (pair.reasonKey !== "name" || guardianIds.size === 0) return false;
  return pair.contacts.every((row) => guardianIds.has(String(row.id)));
}
