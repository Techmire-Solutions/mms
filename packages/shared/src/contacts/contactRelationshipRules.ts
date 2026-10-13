import type { Contact, RelationshipPair } from "./contactEntityTypes.js";
import {
  deriveRelationshipOptionsFromPairs,
  normalizeRelationshipTerm,
  resolveRelationshipPairs,
} from "./contactRelationshipPairUtils.js";

export interface RelationshipLink {
  contactId: string;
  relationship?: string;
  inferred: boolean;
}

export interface PlannedRelationship {
  ownerId: string;
  contactId: string;
  relationship: string;
  inferredFromContactId: string;
  inferenceDepth: number;
}

function genderIsFemale(gender?: string | null): boolean {
  const normalized = typeof gender === "string" ? gender.trim().toLowerCase() : "";
  return (
    normalized === "female" || normalized === "f" || normalized === "woman" || normalized === "girl"
  );
}

function genderIsMale(gender?: string | null): boolean {
  const normalized = typeof gender === "string" ? gender.trim().toLowerCase() : "";
  return (
    normalized === "male" || normalized === "m" || normalized === "man" || normalized === "boy"
  );
}

function isFemale(contact: Contact): boolean {
  return genderIsFemale(contact.gender);
}

function isMale(contact: Contact): boolean {
  return genderIsMale(contact.gender);
}

/**
 * Display-only gender mapping for linked-person labels:
 * Parent → Father/Mother, Child → Son/Daughter, Sibling → Brother/Sister.
 * Stored catalog labels and other types are returned unchanged (trimmed).
 */
export function formatRelationshipDisplayLabel(
  relationship: string,
  gender?: string | null,
): string {
  const trimmed = typeof relationship === "string" ? relationship.trim() : "";
  if (!trimmed) return "";
  const term = normalizeRelationshipTerm(trimmed);
  if (term === "parent") {
    if (genderIsFemale(gender)) return "Mother";
    if (genderIsMale(gender)) return "Father";
    return trimmed;
  }
  if (term === "child") {
    if (genderIsFemale(gender)) return "Daughter";
    if (genderIsMale(gender)) return "Son";
    return trimmed;
  }
  if (term === "sibling") {
    if (genderIsFemale(gender)) return "Sister";
    if (genderIsMale(gender)) return "Brother";
    return "Sibling";
  }
  return trimmed;
}

/**
 * True when `label` appears in the system pair-derived relationship option set.
 * Pass `pairs` to override (tests); otherwise uses {@link DEFAULT_RELATIONSHIP_PAIRS}.
 */
export function isAllowedRelationshipLabel(
  label: string,
  pairs?: RelationshipPair[] | undefined,
): boolean {
  const norm = normalizeRelationshipTerm(label);
  if (!norm) return false;
  const catalog = pairs ?? resolveRelationshipPairs();
  return deriveRelationshipOptionsFromPairs(catalog).some(
    (option) => normalizeRelationshipTerm(option) === norm,
  );
}

/**
 * Resolves the reciprocal relationship label from configured pairs only.
 * Uses the system catalog when `customPairs` is omitted or empty.
 */
export function resolveInverseRelationship(
  relationship: string,
  sourceContact: Contact,
  customPairs?: RelationshipPair[],
): string | null {
  if (!relationship || !relationship.trim()) return null;
  const pairs = customPairs && customPairs.length > 0 ? customPairs : resolveRelationshipPairs();

  const norm = normalizeRelationshipTerm(relationship);

  for (const pair of pairs) {
    const normFwd = normalizeRelationshipTerm(pair.forward);
    const normInv = normalizeRelationshipTerm(pair.inverse);
    const normInvMale = normalizeRelationshipTerm(pair.inverseMale);
    const normInvFemale = normalizeRelationshipTerm(pair.inverseFemale);
    if (norm === normFwd) {
      if (isFemale(sourceContact) && pair.inverseFemale) return pair.inverseFemale;
      if (isMale(sourceContact) && pair.inverseMale) return pair.inverseMale;
      return pair.inverse;
    }
    if (
      norm === normInv ||
      (normInvMale && norm === normInvMale) ||
      (normInvFemale && norm === normInvFemale)
    ) {
      return pair.forward;
    }
  }

  return null;
}
