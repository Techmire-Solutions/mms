/**
 * @file contactProfilePresence.ts
 * @description Presence checks for contact-profile sub-records used by module Setup
 * requirements (e.g. Students requires address + education on the linked contact).
 */
import type { Contact } from "./contactEntityTypes.js";

const hasText = (value: unknown): boolean =>
  typeof value === "string"
    ? value.trim().length > 0
    : value != null && String(value).trim() !== "";

/** True when the contact has a non-empty top-level address or at least one address entry. */
export function contactHasAddress(contact: Contact | null | undefined): boolean {
  if (!contact) return false;
  if (hasText(contact.line1) || hasText(contact.address) || hasText(contact.city)) return true;
  return Boolean(
    contact.addresses?.some(
      (entry) =>
        hasText(entry.line1) ||
        hasText(entry.city) ||
        hasText(entry.state) ||
        hasText(entry.country),
    ),
  );
}

/** True when the contact has at least one education entry (school or degree). */
export function contactHasEducation(contact: Contact | null | undefined): boolean {
  if (!contact) return false;
  return Boolean(
    contact.education?.some(
      (entry) => hasText(entry.institution) || hasText(entry.degree) || hasText(entry.fieldOfStudy),
    ),
  );
}
