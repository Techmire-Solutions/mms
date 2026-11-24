/**
 * @file studentRequiredFields.ts
 * @description Students Setup "Required fields": which form fields must be filled before a
 * student can be saved. Flags live on `settings.fields[tab][n].required`, which both the form
 * and the server blueprint (`buildDynamicStudentSchema`) already enforce.
 */
import type { Contact, FieldDefinition } from "../contacts/contactTypes.js";
import { contactHasAddress, contactHasEducation } from "../contacts/contactProfilePresence.js";
import { contactHasEmail, contactHasPhone } from "../contacts/contactEntityTypes.js";
import { listStudentSystemFormFieldKeys } from "./studentFormCustomFields.js";

/** Fields that are always required (a student row must link a contact). */
export const STUDENT_ALWAYS_REQUIRED_FIELD_KEYS: ReadonlySet<string> = new Set(["contactId"]);

/**
 * Fields Setup never lists as requirable: `contactId` is always required, the
 * registration/system columns (GR number, status, notes, registration date) are
 * owned by their own surfaces, and `gender` is already required by the Contacts
 * module's field seed — the student card does not re-check it.
 */
export const STUDENT_NON_REQUIRABLE_FIELD_KEYS: ReadonlySet<string> = new Set([
  "contactId",
  "grNumber",
  "status",
  "notes",
  "registeredDate",
  "gender",
]);

/**
 * Contact-profile fields: their values live on the linked contact, not the student
 * row. Setup enforces them by reading the linked contact when a student is saved.
 */
export const STUDENT_CONTACT_PROFILE_FIELD_KEYS: ReadonlySet<string> = new Set([
  "gender",
  "dob",
  "contactRelationships",
  "address",
  "education",
  "phone",
  "email",
]);

/**
 * Contact-profile keys that are NOT part of the student form draft, so the blueprint
 * Zod schema must not require them directly (they are validated against the contact).
 */
export const STUDENT_CONTACT_PROFILE_NON_DRAFT_FIELD_KEYS: ReadonlySet<string> = new Set([
  "contactRelationships",
  "address",
  "education",
  "phone",
  "email",
]);

/**
 * Recommended preset: the enrollment-critical profile checks. Date of birth drives
 * admission rules; the Parent pair (father & mother) plus a Guardian give the school
 * two reachable adults; address and education complete the contact profile. Gender is
 * omitted because the Contacts module already requires it.
 */
export const STUDENT_RECOMMENDED_REQUIRED_FIELD_KEYS = [
  "dob",
  "contactRelationships",
  "address",
  "education",
] as const;

const RECOMMENDED_KEY_SET: ReadonlySet<string> = new Set(STUDENT_RECOMMENDED_REQUIRED_FIELD_KEYS);

/** One row of the Setup "Required fields" list. */
export interface StudentRequirableField {
  tabKey: string;
  key: string;
  label: string;
  labelKey?: string;
  /** Hint copy shown under the toggle (from the field seed). */
  description?: string;
  descriptionKey?: string;
  required: boolean;
  /** Part of {@link STUDENT_RECOMMENDED_REQUIRED_FIELD_KEYS}. */
  recommended: boolean;
  /** Tenant-defined field (not part of the seeded student form). */
  isCustom: boolean;
}

function isRequirable(field: FieldDefinition): boolean {
  return field.enabled !== false && !STUDENT_NON_REQUIRABLE_FIELD_KEYS.has(field.key);
}

/** Enabled student form fields whose required flag Setup can show, in form order. */
export function listStudentRequirableFields(
  fields: Record<string, FieldDefinition[]> | undefined,
): StudentRequirableField[] {
  const systemKeys = listStudentSystemFormFieldKeys();
  const rows: StudentRequirableField[] = [];
  for (const [tabKey, tabFields] of Object.entries(fields ?? {})) {
    if (!Array.isArray(tabFields)) continue;
    const ordered = [...tabFields].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    for (const field of ordered) {
      if (!field?.key || !isRequirable(field)) continue;
      rows.push({
        tabKey,
        key: field.key,
        label: field.label,
        ...(field.labelKey ? { labelKey: field.labelKey } : {}),
        ...(field.description ? { description: field.description } : {}),
        ...(field.descriptionKey ? { descriptionKey: field.descriptionKey } : {}),
        required: Boolean(field.required),
        recommended: RECOMMENDED_KEY_SET.has(field.key),
        isCustom: !systemKeys.has(field.key),
      });
    }
  }
  return rows;
}

function mapRequirableFields(
  fields: Record<string, FieldDefinition[]>,
  resolveRequired: (field: FieldDefinition) => boolean,
): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = {};
  for (const [tabKey, tabFields] of Object.entries(fields)) {
    next[tabKey] = (tabFields ?? []).map((field) => {
      if (STUDENT_ALWAYS_REQUIRED_FIELD_KEYS.has(field.key)) return { ...field, required: true };
      if (STUDENT_NON_REQUIRABLE_FIELD_KEYS.has(field.key)) return { ...field };
      return { ...field, required: resolveRequired(field) };
    });
  }
  return next;
}

/** Returns a copy of `fields` with one field's required flag set. */
export function setStudentFieldRequired(
  fields: Record<string, FieldDefinition[]>,
  fieldKey: string,
  required: boolean,
): Record<string, FieldDefinition[]> {
  return mapRequirableFields(fields, (field) =>
    field.key === fieldKey ? required : Boolean(field.required),
  );
}

/** Which contact-profile completeness checks the current Setup enables. */
export interface StudentContactProfileRequirements {
  relationships: boolean;
  address: boolean;
  education: boolean;
  phone: boolean;
  email: boolean;
}

/** Reads the required flags for the contact-profile checks from `settings.fields`. */
export function resolveStudentContactProfileRequirements(
  fields: Record<string, FieldDefinition[]> | undefined,
): StudentContactProfileRequirements {
  const required = new Set<string>();
  for (const tabFields of Object.values(fields ?? {})) {
    if (!Array.isArray(tabFields)) continue;
    for (const field of tabFields) {
      if (field?.enabled !== false && field?.required) required.add(field.key);
    }
  }
  return {
    relationships: required.has("contactRelationships"),
    address: required.has("address"),
    education: required.has("education"),
    phone: required.has("phone"),
    email: required.has("email"),
  };
}

/** Parent-pair + Guardian triad that satisfies the relationships requirement. */
export interface StudentRelationshipTriad {
  fatherContactId?: string | null;
  motherContactId?: string | null;
  guardianContactId?: string | null;
}

/** True when father, mother and a guardian are all linked (Parent pair + Guardian). */
export function studentRelationshipRequirementMet(triad: StudentRelationshipTriad): boolean {
  const present = (id: string | null | undefined) => Boolean(id && String(id).trim());
  return (
    present(triad.fatherContactId) &&
    present(triad.motherContactId) &&
    present(triad.guardianContactId)
  );
}

/** Enabled checks whose linked-contact value is still missing (used by form + API validation). */
export function resolveStudentContactProfileGaps(
  contact: Contact | null | undefined,
  requirements: StudentContactProfileRequirements,
  triad?: StudentRelationshipTriad,
): {
  address: boolean;
  education: boolean;
  relationships: boolean;
  phone: boolean;
  email: boolean;
} {
  return {
    address: requirements.address && !contactHasAddress(contact),
    education: requirements.education && !contactHasEducation(contact),
    relationships:
      requirements.relationships && !(triad ? studentRelationshipRequirementMet(triad) : false),
    phone: requirements.phone && !contactHasPhone(contact),
    email: requirements.email && !contactHasEmail(contact),
  };
}
