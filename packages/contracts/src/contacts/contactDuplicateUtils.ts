import type { Contact, ContactPreferences } from "./contactTypes.js";
import { cleanName, getEmails, getPhoneNumbers } from "../core/utils.js";
import { filterActiveContacts } from "./contactSoftDelete.js";
import { collectContactGuardianIds, isGuardianNameOnlyPair } from "./contactDuplicateGuardians.js";
export {
  areSiblingsSharingParent,
  isParentChildOrGuardianPair,
  PARENT_CHILD_GUARDIAN_RELATIONSHIP_TERMS,
} from "./contactDuplicateFamilyRules.js";
import {
  areSiblingsSharingParent,
  isParentChildOrGuardianPair,
} from "./contactDuplicateFamilyRules.js";

export type ContactDuplicateReasonKey =
  "cnic" | "cnicName" | "phoneEmail" | "namePhone" | "phone" | "nameEmail" | "email" | "name";

export interface ContactDuplicatePair {
  id: string;
  confidence: number;
  reasonKey: ContactDuplicateReasonKey;
  contacts: [Contact, Contact];
}

/** Name buckets larger than this are not paired on name alone (avoids quadratic pairing). */
export const CONTACT_DUPLICATE_NAME_BUCKET_PAIRING_LIMIT = 100;

/** Hard ceiling on pairs emitted by a single scan. */
export const CONTACT_DUPLICATE_MAX_PAIRS = 5_000;

const DEFAULT_DUPLICATE_SCORES = {
  default: 70,
  cnic: 99,
  cnicName: 100,
  phoneEmail: 99,
  namePhone: 95,
  phone: 80,
  nameEmail: 95,
  email: 80,
  name: 75,
} as const;

type DuplicatePreferences = Pick<
  ContactPreferences,
  | "namePrefixesToIgnore"
  | "duplicateDetectionFields"
  | "dismissedDuplicatePairs"
  | "duplicateDetectionScoreDefault"
  | "duplicateDetectionScorePhoneEmail"
  | "duplicateDetectionScoreNamePhone"
  | "duplicateDetectionScoreNameEmail"
  | "duplicateDetectionScorePhone"
  | "duplicateDetectionScoreEmail"
  | "duplicateDetectionScoreName"
>;

function addToIndex<T>(map: Map<string, T[]>, key: string, item: T): void {
  if (!key) return;
  const bucket = map.get(key);
  if (bucket) bucket.push(item);
  else map.set(key, [item]);
}
function pairKey(contactA: Contact, contactB: Contact): string {
  const idA = String(contactA.id);
  const idB = String(contactB.id);
  return idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
}
export function getContactCleanName(contact: Contact, namePrefixesToIgnore?: string[]): string {
  const fullName =
    contact.name?.trim() || [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return cleanName(fullName, namePrefixesToIgnore);
}
function getContactCleanCnic(contact: Contact): string {
  if (!contact.cnic) return "";
  const digits = contact.cnic.replace(/\D/g, "");
  return digits.length === 13 ? digits : "";
}

/** Normalized duplicate keys (phones / emails / name / cnic) shared with SQL blocking. */
export function getContactDuplicateCandidateKeys(
  contact: Contact,
  preferences: DuplicatePreferences = {},
): { phones: string[]; emails: string[]; name: string; cnic: string } {
  return {
    phones: getPhoneNumbers(contact),
    emails: getEmails(contact),
    name: getContactCleanName(contact, preferences.namePrefixesToIgnore),
    cnic: getContactCleanCnic(contact),
  };
}

function hasOverlap(listA: string[], listB: string[]): boolean {
  if (listA.length === 0 || listB.length === 0) return false;
  if (listA.length > 3 || listB.length > 3) {
    const setB = new Set(listB);
    return listA.some((val) => setB.has(val));
  }
  return listA.some((val) => listB.includes(val));
}

function scorePair(
  phoneMatch: boolean,
  emailMatch: boolean,
  nameMatch: boolean,
  cnicMatch: boolean,
  preferences: DuplicatePreferences,
): { confidence: number; reasonKey: ContactDuplicateReasonKey } {
  let confidence = preferences.duplicateDetectionScoreDefault ?? DEFAULT_DUPLICATE_SCORES.default;
  let reasonKey: ContactDuplicateReasonKey = "name";

  if (cnicMatch) {
    confidence = nameMatch ? DEFAULT_DUPLICATE_SCORES.cnicName : DEFAULT_DUPLICATE_SCORES.cnic;
    reasonKey = nameMatch ? "cnicName" : "cnic";
  } else if (phoneMatch && emailMatch) {
    confidence =
      preferences.duplicateDetectionScorePhoneEmail ?? DEFAULT_DUPLICATE_SCORES.phoneEmail;
    reasonKey = "phoneEmail";
  } else if (phoneMatch) {
    confidence = nameMatch
      ? (preferences.duplicateDetectionScoreNamePhone ?? DEFAULT_DUPLICATE_SCORES.namePhone)
      : (preferences.duplicateDetectionScorePhone ?? DEFAULT_DUPLICATE_SCORES.phone);
    reasonKey = nameMatch ? "namePhone" : "phone";
  } else if (emailMatch) {
    confidence = nameMatch
      ? (preferences.duplicateDetectionScoreNameEmail ?? DEFAULT_DUPLICATE_SCORES.nameEmail)
      : (preferences.duplicateDetectionScoreEmail ?? DEFAULT_DUPLICATE_SCORES.email);
    reasonKey = nameMatch ? "nameEmail" : "email";
  } else if (nameMatch) {
    confidence = preferences.duplicateDetectionScoreName ?? DEFAULT_DUPLICATE_SCORES.name;
    reasonKey = "name";
  }

  return { confidence, reasonKey };
}

function evaluatePair(
  contact1: Contact,
  contact2: Contact,
  preferences: DuplicatePreferences,
  keys1?: { phones: string[]; emails: string[]; name: string; cnic: string },
  keys2?: { phones: string[]; emails: string[]; name: string; cnic: string },
): ContactDuplicatePair | null {
  if (isParentChildOrGuardianPair(contact1, contact2)) {
    return null;
  }

  const k1 = keys1 ?? getContactDuplicateCandidateKeys(contact1, preferences);
  const k2 = keys2 ?? getContactDuplicateCandidateKeys(contact2, preferences);

  const fields = preferences.duplicateDetectionFields;
  const allowPhone = !fields?.length || fields.includes("phone");
  const allowEmail = !fields?.length || fields.includes("email");
  const allowName = !fields?.length || fields.includes("name");

  const phoneMatch = allowPhone && hasOverlap(k1.phones, k2.phones);
  const emailMatch = allowEmail && hasOverlap(k1.emails, k2.emails);
  const nameMatch = allowName && Boolean(k1.name && k2.name && k1.name === k2.name);
  const cnicMatch = Boolean(k1.cnic && k2.cnic && k1.cnic === k2.cnic);

  if (!phoneMatch && !emailMatch && !nameMatch && !cnicMatch) return null;

  // Name-only matches with conflicting or asymmetric CNIC, conflicting phones/emails/DOBs are distinct people.
  if (nameMatch && !phoneMatch && !emailMatch && !cnicMatch) {
    if (
      (k1.phones.length > 0 && k2.phones.length > 0) ||
      (k1.emails.length > 0 && k2.emails.length > 0) ||
      Boolean(k1.cnic) !== Boolean(k2.cnic) ||
      (k1.cnic && k2.cnic && k1.cnic !== k2.cnic) ||
      (contact1.dob && contact2.dob && contact1.dob.slice(0, 10) !== contact2.dob.slice(0, 10))
    ) {
      return null;
    }
  }

  if (!nameMatch && areSiblingsSharingParent(contact1, contact2)) {
    return null;
  }

  const { confidence, reasonKey } = scorePair(
    phoneMatch,
    emailMatch,
    nameMatch,
    cnicMatch,
    preferences,
  );
  return {
    id: pairKey(contact1, contact2),
    confidence,
    reasonKey,
    contacts: [contact1, contact2],
  };
}

interface ContactIndexEntry {
  contact: Contact;
  keys: { phones: string[]; emails: string[]; name: string; cnic: string };
}

function collectCandidatesFromKeys(
  indexMap: Map<string, ContactIndexEntry[]>,
  keys: string[],
  targetCandidates: Map<string, ContactIndexEntry>,
): void {
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!key) continue;
    const matches = indexMap.get(key);
    if (matches) {
      for (let j = 0; j < matches.length; j++) {
        const match = matches[j];
        targetCandidates.set(String(match.contact.id), match);
      }
    }
  }
}

export interface FindContactDuplicatePairsOptions {
  includeDeleted?: boolean;
  guardianContactIds?: Iterable<string | number>;
  dismissedPairIds?: Iterable<string>;
}

/** Finds potential duplicate contact pairs (globle1 §2.2). Indexed scan for large directories. */
export function findContactDuplicatePairs(
  contacts: Contact[],
  preferences: DuplicatePreferences = {},
  options?: FindContactDuplicatePairsOptions,
): ContactDuplicatePair[] {
  const pool = options?.includeDeleted ? contacts : filterActiveContacts(contacts);
  const guardianIds = collectContactGuardianIds(pool, options?.guardianContactIds);
  const dismissedIds = new Set<string>([
    ...(preferences.dismissedDuplicatePairs ?? []),
    ...(options?.dismissedPairIds ?? []),
  ]);
  const entries: ContactIndexEntry[] = pool.map((contact) => ({
    contact,
    keys: getContactDuplicateCandidateKeys(contact, preferences),
  }));

  const phoneIndex = new Map<string, ContactIndexEntry[]>();
  const emailIndex = new Map<string, ContactIndexEntry[]>();
  const nameIndex = new Map<string, ContactIndexEntry[]>();
  const cnicIndex = new Map<string, ContactIndexEntry[]>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    for (let j = 0; j < entry.keys.phones.length; j++)
      addToIndex(phoneIndex, entry.keys.phones[j], entry);
    for (let j = 0; j < entry.keys.emails.length; j++)
      addToIndex(emailIndex, entry.keys.emails[j], entry);
    if (entry.keys.name) addToIndex(nameIndex, entry.keys.name, entry);
    if (entry.keys.cnic) addToIndex(cnicIndex, entry.keys.cnic, entry);
  }

  const matchedPairs = new Set<string>();
  const list: ContactDuplicatePair[] = [];

  for (let i = 0; i < entries.length; i++) {
    if (list.length >= CONTACT_DUPLICATE_MAX_PAIRS) break;
    const entry1 = entries[i];
    const candidates = new Map<string, ContactIndexEntry>();
    collectCandidatesFromKeys(phoneIndex, entry1.keys.phones, candidates);
    collectCandidatesFromKeys(emailIndex, entry1.keys.emails, candidates);
    if (entry1.keys.name) {
      const nameBucket = nameIndex.get(entry1.keys.name);
      if (nameBucket && nameBucket.length <= CONTACT_DUPLICATE_NAME_BUCKET_PAIRING_LIMIT) {
        collectCandidatesFromKeys(nameIndex, [entry1.keys.name], candidates);
      }
    }
    if (entry1.keys.cnic) {
      collectCandidatesFromKeys(cnicIndex, [entry1.keys.cnic], candidates);
    }

    for (const entry2 of candidates.values()) {
      if (list.length >= CONTACT_DUPLICATE_MAX_PAIRS) break;
      if (String(entry1.contact.id) === String(entry2.contact.id)) continue;
      const key = pairKey(entry1.contact, entry2.contact);
      if (matchedPairs.has(key) || dismissedIds.has(key)) continue;

      const pair = evaluatePair(
        entry1.contact,
        entry2.contact,
        preferences,
        entry1.keys,
        entry2.keys,
      );
      matchedPairs.add(key);
      if (!pair || isGuardianNameOnlyPair(pair, guardianIds)) continue;
      list.push(pair);
    }
  }

  return list;
}

/** Resolves badge styling and tier classification for duplicate match confidence scores. */

export { getDuplicateConfidenceBadgeStyle } from "./contactDuplicateDisplay.js";
