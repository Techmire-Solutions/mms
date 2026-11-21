/**
 * @file studentRequiredFields.ts
 * @description Students Setup "Required fields": which form fields must be filled before a
 * student can be saved. Flags live on `settings.fields[tab][n].required`, which both the form
 * and the server blueprint (`buildDynamicStudentSchema`) already enforce.
 */
import type { FieldDefinition } from "../contacts/contactTypes.js";
import { listStudentSystemFormFieldKeys } from "./studentFormCustomFields.js";

/** Fields that are always required (a student row must link a contact). */
export const STUDENT_ALWAYS_REQUIRED_FIELD_KEYS: ReadonlySet<string> = new Set(["contactId"]);

/**
 * Fields Setup cannot make required: relationships are read from Contacts and the
 * registration date is stamped by the server, so neither is a form input to enforce.
 */
export const STUDENT_NON_REQUIRABLE_FIELD_KEYS: ReadonlySet<string> = new Set([
  "contactRelationships",
  "registeredDate",
]);

/**
 * Recommended preset: fields enrollment depends on (age/gender admission rules read
 * date of birth and gender) plus the register number and status.
 */
export const STUDENT_RECOMMENDED_REQUIRED_FIELD_KEYS = [
  "gender",
  "dob",
  "grNumber",
  "status",
] as const;

const RECOMMENDED_KEY_SET: ReadonlySet<string> = new Set(STUDENT_RECOMMENDED_REQUIRED_FIELD_KEYS);

/** One row of the Setup "Required fields" list. */
export interface StudentRequirableField {
  tabKey: string;
  key: string;
  label: string;
  labelKey?: string;
  required: boolean;
  /** Always required; Setup shows it but cannot change it. */
  locked: boolean;
  /** Part of {@link STUDENT_RECOMMENDED_REQUIRED_FIELD_KEYS}. */
  recommended: boolean;
  /** Tenant-defined field (not part of the seeded student form). */
  isCustom: boolean;
}

export type StudentRequiredFieldPreset = "recommended" | "custom";

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
      const locked = STUDENT_ALWAYS_REQUIRED_FIELD_KEYS.has(field.key);
      rows.push({
        tabKey,
        key: field.key,
        label: field.label,
        ...(field.labelKey ? { labelKey: field.labelKey } : {}),
        required: locked || Boolean(field.required),
        locked,
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

/** Returns a copy of `fields` with exactly `requiredKeys` required (locked/skipped keys aside). */
export function applyStudentRequiredFieldKeys(
  fields: Record<string, FieldDefinition[]>,
  requiredKeys: Iterable<string>,
): Record<string, FieldDefinition[]> {
  const keys = new Set(requiredKeys);
  return mapRequirableFields(fields, (field) => keys.has(field.key));
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

/** Applies the recommended preset: enrollment-critical fields required, the rest optional. */
export function applyRecommendedStudentRequiredFields(
  fields: Record<string, FieldDefinition[]>,
): Record<string, FieldDefinition[]> {
  return applyStudentRequiredFieldKeys(fields, STUDENT_RECOMMENDED_REQUIRED_FIELD_KEYS);
}

/** `recommended` when the enabled fields' required flags match the preset exactly. */
export function resolveStudentRequiredFieldPreset(
  fields: Record<string, FieldDefinition[]> | undefined,
): StudentRequiredFieldPreset {
  const matches = listStudentRequirableFields(fields).every(
    (row) => row.locked || row.required === row.recommended,
  );
  return matches ? "recommended" : "custom";
}
