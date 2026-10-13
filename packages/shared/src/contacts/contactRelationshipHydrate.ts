import type { Contact, RelationshipContact } from "./contactEntityTypes.js";

/**
 * Resolves relationship links from `relationshipContacts`, falling back to legacy
 * `emergencyContacts` on stored contact JSONB. Strips the legacy key from the result.
 */
export function hydrateContactRelationshipFields<
  T extends Partial<Contact> | Record<string, unknown>,
>(contact: T): T {
  if (!contact || typeof contact !== "object") return contact;

  const record = { ...contact } as T & {
    relationshipContacts?: RelationshipContact[];
    relationships?: RelationshipContact[];
    emergencyContacts?: RelationshipContact[];
  };

  const hasExplicitRelationshipContacts =
    Array.isArray(record.relationshipContacts) && record.relationshipContacts.length > 0;
  if (!hasExplicitRelationshipContacts) {
    if (Array.isArray(record.relationships) && record.relationships.length > 0) {
      record.relationshipContacts = record.relationships;
    } else if (
      Array.isArray(record.emergencyContacts) &&
      !Array.isArray(record.relationshipContacts)
    ) {
      record.relationshipContacts = record.emergencyContacts;
    }
  }

  delete record.emergencyContacts;
  return record;
}
