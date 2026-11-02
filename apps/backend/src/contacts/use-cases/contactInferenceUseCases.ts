import {
  getEmails,
  getPhoneNumbers,
  type Contact,
  type ContactIdentityMatchBody,
  type ContactIdentityMatchResult,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import type { ContactsRepository } from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";

/**
 * Returns which candidate phones/emails/names already exist in the tenant
 * directory. SQL-scoped — does not hydrate the full contacts list.
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

export {
  applyContactRelationshipInference,
  type ContactRelationshipInferenceOptions,
} from "./contactInferenceApply.js";
