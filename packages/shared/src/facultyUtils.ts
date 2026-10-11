import type { FacultyMember } from "./facultyTypes.js";
import type { ContactLike } from "./contactLinkPolicy.js";
import {
  CONTACT_PROFILE_FIELDS,
  createContactLookupMap,
  hydrateContactProfile,
  lookupContact,
  stripRecordFields,
} from "./contactLinkPolicy.js";
export {
  FACULTY_CLIENT_SOFT_DELETE_KEYS,
  stripFacultyClientSoftDeleteFields,
  stripClientSoftDeleteFields,
  isEntityDeleted,
  filterActiveEntities,
  isFacultyDeleted,
  filterActiveFaculty,
} from "./facultySoftDelete.js";

import { stripFacultyClientSoftDeleteFields } from "./facultySoftDelete.js";

/**
 * Soft-delete + Contacts profile dual-write strip shared by wire preprocess and dynamic Zod.
 * Does not mutate empty `contactId` (see {@link normalizeStoredFaculty}).
 */
export function stripFacultyWriteNoise(record: Record<string, unknown>): Record<string, unknown> {
  const next = stripFacultyClientSoftDeleteFields({ ...record }) as Record<string, unknown>;
  // Avatar lives on the canonical Contact — never dual-write it onto a faculty row.
  delete next.avatar;
  delete next.contact;
  delete next.designationAssignableRoles;
  delete next.subordinates;
  // Denormalised read-model fields derived from `designationId` on the server.
  delete next.departmentId;
  delete next.departmentName;
  delete next.designationName;
  delete next.parentDesignationId;
  delete next.parentDesignationName;
  return stripRecordFields(next, CONTACT_PROFILE_FIELDS);
}

/**
 * Strips contact-owned profile fields and client soft-delete metadata before persisting a faculty row.
 * Profile keys are always removed (contacts are SSOT) — including when `contactId` is empty/absent.
 */
export function normalizeStoredFaculty<T extends Record<string, unknown>>(record: T): T {
  const next = stripFacultyWriteNoise(record as Record<string, unknown>);
  const contactId = next.contactId;
  if (contactId === "" || contactId == null) {
    delete next.contactId;
  }
  return next as T;
}

/**
 * Resolves the academic or teaching qualification degrees from a linked contact record.
 * Inspects `contact.education` degrees first, falling back to scalar qualification if present.
 */
export function getContactQualification(contact?: ContactLike | null): string {
  if (!contact) return "";
  if (Array.isArray(contact.education) && contact.education.length > 0) {
    const degrees = contact.education
      .map((edu) => (typeof edu?.degree === "string" ? edu.degree.trim() : ""))
      .filter(Boolean);
    if (degrees.length > 0) {
      return Array.from(new Set(degrees)).join(", ");
    }
  }
  if (typeof (contact as Record<string, unknown>).qualification === "string") {
    return ((contact as Record<string, unknown>).qualification as string).trim();
  }
  return "";
}

/**
 * Resolves teaching subject specialization from a linked contact record.
 * Inspects `contact.education` fieldOfStudy, `contact.skills` names, or scalar specialization.
 */
export function getContactSpecialization(contact?: ContactLike | null): string {
  if (!contact) return "";
  if (Array.isArray(contact.education) && contact.education.length > 0) {
    const fields = contact.education
      .map((edu) => (typeof edu?.fieldOfStudy === "string" ? edu.fieldOfStudy.trim() : ""))
      .filter(Boolean);
    if (fields.length > 0) {
      return Array.from(new Set(fields)).join(", ");
    }
  }
  if (Array.isArray(contact.skills) && contact.skills.length > 0) {
    const skillNames = contact.skills
      .map((skill) => (typeof skill?.name === "string" ? skill.name.trim() : ""))
      .filter(Boolean);
    if (skillNames.length > 0) {
      return Array.from(new Set(skillNames)).join(", ");
    }
  }
  if (typeof (contact as Record<string, unknown>).specialization === "string") {
    return ((contact as Record<string, unknown>).specialization as string).trim();
  }
  return "";
}

/** Resolves display fields (including the canonical avatar, qualification, and specialization) from the linked contact record. */
export function hydrateFacultyFromContact<T extends FacultyMember>(
  facultyMember: T,
  contacts: ContactLike[] | Map<string, ContactLike>,
): T {
  const contactLookup =
    contacts instanceof Map
      ? contacts
      : Array.isArray(contacts) && contacts.length > 8
        ? createContactLookupMap(contacts)
        : contacts;
  const hydrated = hydrateContactProfile(
    facultyMember as Record<string, unknown>,
    contactLookup,
    "contactId",
  ) as T;
  const contactId = String(hydrated.contactId ?? "");
  if (contactId) {
    const contact = lookupContact(contactLookup, contactId);
    if (contact) {
      if (contact.avatar && hydrated.avatar !== contact.avatar) {
        hydrated.avatar = contact.avatar;
      }
      const qualification = getContactQualification(contact);
      if (qualification) {
        hydrated.qualification = qualification;
      }
      const specialization = getContactSpecialization(contact);
      if (specialization) {
        hydrated.specialization = specialization;
      }
    }
  }
  return hydrated;
}

/** Formats a faculty member's display name, appending the employee ID when available. */
export function formatFacultyDisplayName(
  facultyMember?:
    | (Partial<FacultyMember> & {
        firstName?: string;
        lastName?: string;
        contact?: { firstName?: string; lastName?: string } | null;
      })
    | null,
): string {
  if (!facultyMember) return "";
  const firstName = facultyMember.firstName || facultyMember.contact?.firstName || "";
  const lastName = facultyMember.lastName || facultyMember.contact?.lastName || "";
  const name = (facultyMember.name || [firstName, lastName].filter(Boolean).join(" ")).trim();
  if (name) {
    return facultyMember.employeeId ? `${name} (${facultyMember.employeeId})` : name;
  }
  if (facultyMember.employeeId) {
    return `Faculty (${facultyMember.employeeId})`;
  }
  return facultyMember.id ? `Faculty #${String(facultyMember.id).slice(0, 8)}` : "";
}

/** Batch hydrates faculty members from contacts with O(1) indexed lookup. */
export function hydrateFacultyListFromContacts<T extends FacultyMember>(
  facultyList: T[],
  contacts: ContactLike[] | Map<string, ContactLike>,
): T[] {
  if (!Array.isArray(facultyList) || facultyList.length === 0) return [];
  const contactLookup = contacts instanceof Map ? contacts : createContactLookupMap(contacts);
  return facultyList.map((facultyMember) =>
    hydrateFacultyFromContact(facultyMember, contactLookup),
  );
}

export const getFacultyQualification = getContactQualification;
export const getFacultySpecialization = getContactSpecialization;
