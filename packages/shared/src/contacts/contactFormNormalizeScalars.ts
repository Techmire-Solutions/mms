import type { Contact } from "./contactTypes.js";

/**
 * Derives and clears scalar mirror fields (phone/email/address) from the
 * canonical collection arrays. When a collection is explicitly provided as
 * an empty array, the corresponding scalar is cleared. When a collection
 * has rows, the scalar is derived from the primary (or first) row.
 * Collections that are absent (undefined) leave existing scalars untouched.
 */
export function syncContactScalarFields<T extends Partial<Contact>>(contact: T): T {
  const result: Partial<Contact> = { ...contact };

  // Phone scalar
  if (Array.isArray(contact.phones)) {
    const primary = contact.phones.find((p) => p.isPrimary) ?? contact.phones[0];
    if (primary) {
      const { countryCode = "", number = "" } = primary;
      result.phone = countryCode ? `${countryCode} ${number}`.trim() : number.trim();
    } else {
      result.phone = "";
    }
  }

  // Email scalar
  if (Array.isArray(contact.emails)) {
    const primary = contact.emails.find((e) => e.isPrimary) ?? contact.emails[0];
    result.email = primary?.address ?? "";
  }

  // Address scalars
  if (Array.isArray(contact.addresses)) {
    const primary = contact.addresses.find((a) => a.isPrimary) ?? contact.addresses[0];
    result.line1 = primary?.line1 ?? "";
    result.city = primary?.city ?? "";
    result.state = primary?.state ?? "";
    result.country = primary?.country ?? "";
    result.address = primary?.line1 ?? "";
  }

  return result as T;
}

/**
 * Merge an edit-form draft onto an existing contact for persistence.
 * Draft collections (and synced scalars) win over stale existing fields.
 */
export function mergeContactEditSavePayload(
  existing: Partial<Contact> | null | undefined,
  draft: Partial<Contact>,
): Contact {
  // Strip UI-only `tag` string before merge
  const { tag: _draftTag, ...draftClean } = draft as Record<string, unknown>;
  const { tag: _existingTag, ...existingClean } = (existing || {}) as Record<string, unknown>;

  const withCollections: Partial<Contact> = {
    ...(draftClean as Partial<Contact>),
    tags: draft.tags ?? existing?.tags ?? [],
    phones: draft.phones ?? [],
    emails: draft.emails ?? [],
    addresses: draft.addresses ?? [],
    socials: draft.socials ?? [],
    education: draft.education ?? [],
    experience: draft.experience ?? [],
    skills: draft.skills ?? [],
    bankDetails: draft.bankDetails ?? [],
    relationshipContacts: draft.relationshipContacts ?? [],
  };
  const synced = syncContactScalarFields(withCollections);
  const clearLegacyRelationships =
    Array.isArray(withCollections.relationshipContacts) &&
    withCollections.relationshipContacts.length === 0;

  return {
    ...existingClean,
    ...synced,
    ...(clearLegacyRelationships ? { relationships: [] } : {}),
  } as Contact;
}
