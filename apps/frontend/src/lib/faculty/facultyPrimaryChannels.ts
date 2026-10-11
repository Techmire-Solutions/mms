import { getPrimaryEmail, getPrimaryPhone, type Contact, type FacultyMember } from "@mms/shared";

export type FacultyPrimaryChannels = {
  phone: string | null;
  email: string | null;
};

/**
 * Phone/email for Faculty detail + directory messaging.
 * Prefers linked-contact primaries when provided; falls back to hydrated faculty scalars.
 */
export function resolveFacultyPrimaryChannels(
  faculty: Pick<FacultyMember, "phone" | "email">,
  linkedContact?: Partial<Contact> | null,
): FacultyPrimaryChannels {
  const phone =
    (linkedContact ? getPrimaryPhone(linkedContact) : null) || faculty.phone?.trim() || null;
  const email =
    (linkedContact ? getPrimaryEmail(linkedContact) : null) || faculty.email?.trim() || null;
  return { phone, email };
}
