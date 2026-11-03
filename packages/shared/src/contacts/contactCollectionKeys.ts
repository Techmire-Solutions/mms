import type { Contact } from "./contactTypes.js";

/**
 * Every contact property owned by a Setup tab, grouped by the tab key.
 *
 * Single owner for the read sanitizer (what a role may see) and the write guards
 * (what a role may send): if a tab is hidden, its collection **and** its scalar
 * mirrors must be treated as "not visible" on both sides, or a save echoes an
 * empty scalar back and clears the stored value (R4-03).
 */
export const CONTACT_TAB_COLLECTION_KEYS: Record<string, readonly (keyof Contact)[]> = {
  phones: ["phones", "phone"],
  emails: ["emails", "email"],
  addresses: ["addresses", "line1", "city", "state", "country"],
  socials: ["socials"],
  relationship: ["relationshipContacts"],
  relationships: ["relationships"],
  education: ["education"],
  experience: ["experience"],
  skills: ["skills"],
  bankDetails: ["bankDetails"],
  activities: ["activities"],
  attachments: ["attachments"],
};

/** The array-backed collections (the first key of every group). */
export const CONTACT_COLLECTION_KEYS: readonly (keyof Contact)[] = Object.values(
  CONTACT_TAB_COLLECTION_KEYS,
).map((keys) => keys[0]);
