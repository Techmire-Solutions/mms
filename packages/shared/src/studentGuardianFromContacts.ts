import type { ContactRelationship, RelationshipContact } from "./contactEntityTypes.js";
import type { ContactLike } from "./contactLinkPolicy.js";
import { isAllowedRelationshipLabel } from "./contactRelationshipRules.js";
import {
  DEFAULT_RELATIONSHIP_PAIRS,
  normalizeRelationshipTerm,
} from "./contactRelationshipPairUtils.js";

function pairForwardLabel(pairId: string): string {
  const pair = DEFAULT_RELATIONSHIP_PAIRS.find((entry) => entry.id === pairId);
  return pair?.forward ?? pairId;
}

/** Catalog forward label for Parent (system pair `parent_child`). */
export const STUDENT_PARENT_RELATIONSHIP_LABEL = pairForwardLabel("parent_child");
/** Catalog forward label for Guardian (system pair `guardian_dependent`). */
export const STUDENT_GUARDIAN_RELATIONSHIP_LABEL = pairForwardLabel("guardian_dependent");

export type StudentContactRelationshipLink = {
  contactId?: string;
  name?: string;
  phone?: string;
  /** Linked contact email when known (guardian card messaging action). */
  email?: string;
  /** Linked contact gender when known (for Parent/Child display mapping). */
  gender?: string;
  relationship: string;
};

/** Triad shape for list/detail hydrate slots (Father, Mother, Guardian). */
export type DerivedStudentGuardianLinks = {
  fatherContactId?: string;
  motherContactId?: string;
  guardianContactId?: string;
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
};

export type RelationshipLinkLike = {
  contactId?: string | number | null;
  name?: string;
  phone?: string;
  email?: string;
  gender?: string;
  relationship?: string;
  inferred?: boolean;
};

export type ContactWithRelationships = ContactLike & {
  relationshipContacts?: RelationshipContact[];
  relationships?: ContactRelationship[];
};

const RESPONSIBLE_ADULT_LABELS = new Set(["parent", "guardian"]);

/** Merge relationshipContacts + legacy relationships; prefer non-inferred when both exist. */
export function collectContactRelationshipLinks(
  contact?: ContactWithRelationships | null,
): RelationshipLinkLike[] {
  if (!contact) return [];
  const byKey = new Map<string, RelationshipLinkLike>();

  const add = (entry: RelationshipLinkLike) => {
    const contactId = entry.contactId == null ? "" : String(entry.contactId).trim();
    const name = (entry.name || "").trim();
    const phone = (entry.phone || "").trim();
    const email = (entry.email || "").trim();
    const gender = (entry.gender || "").trim();
    if (!contactId && !name && !phone) return;

    const key = contactId || (name ? `name:${name.toLowerCase()}` : `phone:${phone}`);
    const existing = byKey.get(key);
    if (existing && existing.inferred !== true && entry.inferred === true) return;
    byKey.set(key, {
      contactId,
      name: name || existing?.name,
      phone: phone || existing?.phone,
      email: email || existing?.email,
      gender: gender || existing?.gender,
      relationship: entry.relationship || existing?.relationship,
      inferred: entry.inferred === true,
    });
  };

  for (const entry of contact.relationshipContacts ?? []) add(entry);
  for (const entry of contact.relationships ?? []) add(entry);

  return [...byKey.values()];
}

/**
 * Lists the student contact’s relationship links that use the fixed system catalog
 * (Parent/Child, Husband/Wife, Guardian/Dependent).
 */
export function listStudentContactRelationships(
  contact?: ContactWithRelationships | null,
): StudentContactRelationshipLink[] {
  if (!contact) return [];
  const links: StudentContactRelationshipLink[] = [];
  for (const link of collectContactRelationshipLinks(contact)) {
    const relationship = (link.relationship || "").trim();
    if (!relationship || !isAllowedRelationshipLabel(relationship)) continue;
    const contactId = link.contactId == null ? "" : String(link.contactId).trim();
    const name = (link.name || "").trim();
    if (!contactId && !name) continue;
    links.push({
      ...(contactId ? { contactId } : {}),
      ...(name ? { name } : {}),
      ...(link.phone ? { phone: link.phone } : {}),
      ...(link.email ? { email: link.email } : {}),
      ...(link.gender ? { gender: link.gender } : {}),
      relationship,
    });
  }
  return links;
}

/** True when the contact has a Parent or Guardian link (responsible adult). */
export function hasResponsibleAdultLink(contact?: ContactWithRelationships | null): boolean {
  if (!contact) return false;
  return collectContactRelationshipLinks(contact).some((link) => {
    const rel = (link.relationship || "").trim();
    return Boolean(
      rel &&
      isAllowedRelationshipLabel(rel) &&
      RESPONSIBLE_ADULT_LABELS.has(normalizeRelationshipTerm(rel)),
    );
  });
}

/** First Parent link, else first Guardian link — for list/detail primary display. */
export function pickPrimaryResponsibleAdult(
  links: readonly StudentContactRelationshipLink[],
): StudentContactRelationshipLink | undefined {
  return (
    links.find((l) => normalizeRelationshipTerm(l.relationship) === "parent") ??
    links.find((l) => normalizeRelationshipTerm(l.relationship) === "guardian")
  );
}

/** Display name for list/export: Father, else Mother, else Guardian. */
export function primaryResponsibleAdultDisplayName(
  student?: {
    fatherName?: string | null;
    motherName?: string | null;
    guardianName?: string | null;
  } | null,
): string {
  return (student?.fatherName || student?.motherName || student?.guardianName || "").trim();
}

/**
 * Derives student parent and guardian links from the contact relationship graph,
 * resolving father, mother, and guardian contact IDs and names with legacy field fallbacks.
 */
export function resolveStudentGuardianLinks(
  student: {
    fatherContactId?: string | number | null;
    motherContactId?: string | number | null;
    guardianContactId?: string | number | null;
    fatherName?: string | null;
    motherName?: string | null;
    guardianName?: string | null;
  },
  primaryContact?: ContactWithRelationships | null,
): DerivedStudentGuardianLinks {
  const links = listStudentContactRelationships(primaryContact);
  const parentLinks: StudentContactRelationshipLink[] = [];
  let guardian: StudentContactRelationshipLink | undefined;
  let explicitFatherLink: StudentContactRelationshipLink | undefined;
  let explicitMotherLink: StudentContactRelationshipLink | undefined;

  for (const link of links) {
    const relTerm = normalizeRelationshipTerm(link.relationship);
    if (relTerm === "parent") {
      parentLinks.push(link);
      if (!explicitFatherLink && link.gender === "male") explicitFatherLink = link;
      else if (!explicitMotherLink && link.gender === "female") explicitMotherLink = link;
    } else if (!guardian && relTerm === "guardian") {
      guardian = link;
    }
  }

  const toLegacyId = (id: unknown) => (id != null && String(id).trim() ? String(id) : undefined);
  let fatherLink = explicitFatherLink;
  let motherLink: typeof explicitMotherLink;
  if (explicitFatherLink || explicitMotherLink) {
    fatherLink =
      explicitFatherLink ??
      parentLinks.find((l) => l !== explicitMotherLink && l.gender !== "female");
    motherLink =
      explicitMotherLink ?? parentLinks.find((l) => l !== fatherLink && l.gender !== "male");
  } else {
    [fatherLink, motherLink] = parentLinks;
  }

  return {
    fatherContactId: fatherLink?.contactId ?? toLegacyId(student.fatherContactId),
    fatherName: fatherLink?.name ?? (student.fatherName?.trim() || undefined),
    motherContactId: motherLink?.contactId ?? toLegacyId(student.motherContactId),
    motherName: motherLink?.name ?? (student.motherName?.trim() || undefined),
    guardianContactId: guardian?.contactId ?? toLegacyId(student.guardianContactId),
    guardianName: guardian?.name ?? (student.guardianName?.trim() || undefined),
  };
}

/** @deprecated Use {@link listStudentContactRelationships}. */
export function deriveStudentGuardiansFromContact(
  contact: ContactWithRelationships,
): DerivedStudentGuardianLinks {
  return resolveStudentGuardianLinks({}, contact);
}
