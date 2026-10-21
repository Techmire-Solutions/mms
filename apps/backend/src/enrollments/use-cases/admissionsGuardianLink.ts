import { randomUUID } from "node:crypto";
import type { Contact, RelationshipContact, User } from "@mms/shared";
import { upsertContact } from "../../contacts/use-cases/contactWriteUseCases.js";

/** Relationship label written on the student's contact for an application guardian. */
export const GUARDIAN_RELATIONSHIP = "guardian";

/**
 * Creates the guardian's own contact from an application.
 *
 * The public form collects a guardian name but no guardian phone or email, so the contact holds
 * the name alone — the phone on the application belongs to the applicant, not the guardian, and
 * guessing otherwise would put the wrong number on the wrong person. Returns null for a blank
 * name so the caller can fall back to `students.guardian_name`.
 */
export async function createGuardianContact(
  guardianName: string,
  user: User | undefined,
): Promise<string | null> {
  const name = guardianName.trim();
  if (!name) return null;
  const [firstName, ...rest] = name.split(/\s+/);
  const contact: Contact = {
    id: randomUUID(),
    name,
    firstName: firstName ?? name,
    lastName: rest.join(" ") || undefined,
  };
  const saved = await upsertContact(contact, user ? { user } : undefined);
  return String(saved.contact.id);
}

/** The guardian link to store on the student's contact, or none when there is no guardian contact. */
export function guardianRelationships(
  guardianContactId: string | null,
  guardianName: string,
): RelationshipContact[] | undefined {
  if (!guardianContactId) return undefined;
  return [
    { contactId: guardianContactId, name: guardianName.trim(), relationship: GUARDIAN_RELATIONSHIP },
  ];
}
