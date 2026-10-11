import {
  getEmails,
  getPhoneNumbers,
  resolveRelationshipPairs,
  resolveInverseRelationship,
  type Contact,
  type ContactIdentityMatchBody,
  type ContactIdentityMatchResult,
  type ContactRelationship,
  type RelationshipContact,
  type RelationshipPair,
  type PlannedRelationship,
  type RelationshipLink,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { loadContactPreferences } from "./contactPreferencesService.js";
import type { ContactsRepository } from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";

/**
 * Returns which candidate phones/emails/names already exist in the tenant directory.
 * SQL-scoped — does not hydrate the full contacts list.
 */
export async function matchContactIdentityIndex(
  candidates: ContactIdentityMatchBody,
  repo: ContactsRepository = contactsRepository,
): Promise<ContactIdentityMatchResult> {
  const tenant = getRequestTenant();
  if (!tenant) {
    return { phones: [], emails: [], names: [] };
  }

  const phoneDigits = candidates.phones;
  const emails = candidates.emails.map((email) => email.toLowerCase());
  const names = candidates.names.map((name) => name.toLowerCase().trim()).filter(Boolean);

  const matchingContacts =
    phoneDigits.length > 0 || emails.length > 0
      ? await repo.findActiveContactsMatchingUniqueValues(tenant, {
          phoneDigits,
          emails,
          scalars: [],
        })
      : [];

  const existingPhones = new Set<string>();
  const existingEmails = new Set<string>();
  const candidatePhoneSet = new Set(phoneDigits);
  const candidateEmailSet = new Set(emails);

  for (const contact of matchingContacts) {
    collectMatchingPhones(contact, candidatePhoneSet, existingPhones);
    for (const email of getEmails(contact)) {
      const normalized = email.toLowerCase().trim();
      if (candidateEmailSet.has(normalized)) existingEmails.add(normalized);
    }
  }

  const existingNames =
    names.length > 0
      ? await repo.findExistingNormalizedContactNames(tenant, names)
      : new Set<string>();

  const namesSet = new Set(names);
  return {
    phones: [...existingPhones],
    emails: [...existingEmails],
    names: [...existingNames].filter((name) => namesSet.has(name)),
  };
}

function collectMatchingPhones(
  contact: Contact,
  candidatePhoneSet: Set<string>,
  existingPhones: Set<string>,
): void {
  // Unique-index SQL matches full digit keys; also accept last-10 FE comparison keys.
  for (const phone of contact.phones ?? []) {
    const raw = String(phone.number || "").trim();
    if (!raw) continue;
    const digits = raw.replace(/\D/g, "");
    const withCountry = `${String(phone.countryCode || "").replace(/\D/g, "")}${digits}`.replace(
      /\D/g,
      "",
    );
    for (const key of [digits, withCountry, digits.slice(-10), withCountry.slice(-10)]) {
      if (key && candidatePhoneSet.has(key)) existingPhones.add(key);
    }
  }
  for (const key of getPhoneNumbers(contact)) {
    if (candidatePhoneSet.has(key)) existingPhones.add(key);
  }
}

function linksForContact(contact: Contact): RelationshipLink[] {
  const collect = (entry: RelationshipContact | ContactRelationship): RelationshipLink | null => {
    const contactId = entry.contactId == null ? "" : String(entry.contactId);
    if (!contactId.trim()) return null;
    return {
      contactId,
      relationship: entry.relationship,
      inferred: "inferred" in entry && entry.inferred === true,
    };
  };

  return [...(contact.relationshipContacts ?? []), ...(contact.relationships ?? [])]
    .map(collect)
    .filter((entry): entry is RelationshipLink => Boolean(entry));
}

function setInferredRelationshipContact(contact: Contact, planned: PlannedRelationship): Contact {
  const relationshipContacts = contact.relationshipContacts ?? [];
  const existingIndex = relationshipContacts.findIndex(
    (entry) => String(entry.contactId) === planned.contactId,
  );
  const relationshipEntry: RelationshipContact = {
    contactId: planned.contactId,
    relationship: planned.relationship,
    inferred: true,
    inferredFromContactId: planned.inferredFromContactId,
    inferenceDepth: planned.inferenceDepth,
  };
  const nextRelationshipContacts =
    existingIndex >= 0
      ? relationshipContacts.map((entry, index) =>
          index === existingIndex ? { ...entry, ...relationshipEntry } : entry,
        )
      : [...relationshipContacts, relationshipEntry];

  return {
    ...contact,
    relationshipContacts: nextRelationshipContacts,
  };
}

/**
 * Writes reciprocal relationship links from tenant-configured pairs only.
 * No hardcoded family-role graph or depth-2/3 inference.
 */
export async function applyContactRelationshipInference(
  tenant: string,
  sourceContact: Contact,
  customPairs?: RelationshipPair[],
  repo: ContactsRepository = contactsRepository,
): Promise<void> {
  const sourceId = String(sourceContact.id);
  const sourceLinks = linksForContact(sourceContact).filter(
    (entry) => entry.contactId !== sourceId,
  );
  if (sourceLinks.length === 0) return;

  const resolvedPairs =
    customPairs && customPairs.length > 0
      ? customPairs
      : resolveRelationshipPairs((await loadContactPreferences())?.relationshipPairs);
  if (resolvedPairs.length === 0) return;

  const firstIds = Array.from(new Set(sourceLinks.map((entry) => entry.contactId)));
  const firstContacts = await repo.findByIds(tenant, firstIds);
  const contactsById = new Map<string, Contact>([
    [sourceId, sourceContact],
    ...firstContacts.map((contact) => [String(contact.id), contact] as const),
  ]);
  const planned = new Map<string, PlannedRelationship>();

  for (const sourceLink of sourceLinks) {
    const target = contactsById.get(sourceLink.contactId);
    if (!target || target.deletedAt) continue;

    const reciprocalLabel = resolveInverseRelationship(
      sourceLink.relationship ?? "",
      sourceContact,
      resolvedPairs,
    );
    if (!reciprocalLabel) continue;

    planned.set(`${sourceLink.contactId}:${sourceId}`, {
      ownerId: sourceLink.contactId,
      contactId: sourceId,
      relationship: reciprocalLabel,
      inferredFromContactId: sourceId,
      inferenceDepth: 1,
    });
  }

  const updatesById = new Map<string, Contact>();
  for (const relationship of planned.values()) {
    const owner = updatesById.get(relationship.ownerId) ?? contactsById.get(relationship.ownerId);
    if (!owner || owner.deletedAt) continue;
    updatesById.set(relationship.ownerId, setInferredRelationshipContact(owner, relationship));
  }

  const updates = Array.from(updatesById.values());
  if (updates.length > 0) {
    await repo.bulkSave(tenant, updates);
  }
}
