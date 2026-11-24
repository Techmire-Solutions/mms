import type { Contact } from "./contactTypes.js";
import { cleanName } from "../core/utils.js";
import { normalizeRelationshipTerm } from "./contactRelationshipPairUtils.js";
import {
  collectContactRelationshipLinks,
  type ContactWithRelationships,
} from "../students/studentGuardianFromContacts.js";

export const PARENT_CHILD_GUARDIAN_RELATIONSHIP_TERMS = new Set([
  "parent",
  "father",
  "mother",
  "child",
  "son",
  "daughter",
  "guardian",
  "dependent",
  "ward",
]);

function resolveCleanFullName(contact: Partial<Contact>): string {
  const fullName =
    contact.name?.trim() || [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return cleanName(fullName);
}

/**
 * True when contacts share a reciprocal Parent/Child or Guardian/Dependent relationship.
 * Excludes parent-link contexts from being flagged as duplicate contacts.
 */
export function isParentChildOrGuardianPair(
  contact1: Partial<Contact>,
  contact2: Partial<Contact>,
): boolean {
  if (!contact1 || !contact2) return false;
  const id1 = contact1.id != null ? String(contact1.id).trim() : "";
  const id2 = contact2.id != null ? String(contact2.id).trim() : "";

  const name1 = resolveCleanFullName(contact1);
  const name2 = resolveCleanFullName(contact2);

  const links1 = collectContactRelationshipLinks(contact1 as ContactWithRelationships);
  for (let i = 0; i < links1.length; i++) {
    const link = links1[i];
    const term = normalizeRelationshipTerm(link.relationship);
    if (!PARENT_CHILD_GUARDIAN_RELATIONSHIP_TERMS.has(term)) continue;
    const targetId = link.contactId != null ? String(link.contactId).trim() : "";
    const targetName = cleanName(link.name);
    if ((id2 && targetId && targetId === id2) || (name2 && targetName && targetName === name2)) {
      return true;
    }
  }

  const links2 = collectContactRelationshipLinks(contact2 as ContactWithRelationships);
  for (let i = 0; i < links2.length; i++) {
    const link = links2[i];
    const term = normalizeRelationshipTerm(link.relationship);
    if (!PARENT_CHILD_GUARDIAN_RELATIONSHIP_TERMS.has(term)) continue;
    const targetId = link.contactId != null ? String(link.contactId).trim() : "";
    const targetName = cleanName(link.name);
    if ((id1 && targetId && targetId === id1) || (name1 && targetName && targetName === name1)) {
      return true;
    }
  }

  const c1Record = contact1 as Record<string, unknown>;
  const c2Record = contact2 as Record<string, unknown>;
  const guardianFields = ["fatherContactId", "motherContactId", "guardianContactId"] as const;
  for (const guardianKey of guardianFields) {
    const g1 = c1Record[guardianKey] != null ? String(c1Record[guardianKey]).trim() : "";
    if (g1 && id2 && g1 === id2) return true;
    const g2 = c2Record[guardianKey] != null ? String(c2Record[guardianKey]).trim() : "";
    if (g2 && id1 && g2 === id1) return true;
  }

  return false;
}

/**
 * True when two contacts have links to the same parent/guardian.
 */
export function areSiblingsSharingParent(
  contact1: Partial<Contact>,
  contact2: Partial<Contact>,
): boolean {
  if (!contact1 || !contact2) return false;
  const parentIds1 = new Set<string>();
  const parentIds2 = new Set<string>();

  const c1Record = contact1 as Record<string, unknown>;
  const c2Record = contact2 as Record<string, unknown>;
  const guardianFields = ["fatherContactId", "motherContactId", "guardianContactId"] as const;
  for (const key of guardianFields) {
    const val1 = c1Record[key] != null ? String(c1Record[key]).trim() : "";
    if (val1) parentIds1.add(val1);
    const val2 = c2Record[key] != null ? String(c2Record[key]).trim() : "";
    if (val2) parentIds2.add(val2);
  }

  const links1 = collectContactRelationshipLinks(contact1 as ContactWithRelationships);
  for (const link of links1) {
    const term = normalizeRelationshipTerm(link.relationship);
    if (term === "parent" || term === "father" || term === "mother" || term === "guardian") {
      const pid = link.contactId != null ? String(link.contactId).trim() : "";
      if (pid) parentIds1.add(pid);
    }
  }

  const links2 = collectContactRelationshipLinks(contact2 as ContactWithRelationships);
  for (const link of links2) {
    const term = normalizeRelationshipTerm(link.relationship);
    if (term === "parent" || term === "father" || term === "mother" || term === "guardian") {
      const pid = link.contactId != null ? String(link.contactId).trim() : "";
      if (pid) parentIds2.add(pid);
    }
  }

  if (parentIds1.size === 0 || parentIds2.size === 0) return false;
  for (const pid of parentIds1) {
    if (parentIds2.has(pid)) return true;
  }
  return false;
}
