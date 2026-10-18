/**
 * @file studentFormCustomFields.ts
 * @description Helpers for Students form custom (non-seed) fields and default value application.
 */
import { INITIAL_STUDENT_FIELD_SEED } from "../settings/moduleFieldSetupPersons.js";
import { createFormCustomFieldHelpers } from "../core/createFormCustomFieldHelpers.js";
import type { Student } from "./studentTypes.js";
import type { FieldDefinition } from "../contacts/contactFieldSchemaTypes.js";
import { getFlatFieldsConfig } from "../settings/moduleFieldConfigUtils.js";

const helpers = createFormCustomFieldHelpers(INITIAL_STUDENT_FIELD_SEED);

/**
 * Returns keys owned by static student form chrome (`INITIAL_STUDENT_FIELD_SEED`).
 */
export function listStudentSystemFormFieldKeys(): ReadonlySet<string> {
  return helpers.listSystemFormFieldKeys();
}

/**
 * Deep-clone {@link INITIAL_STUDENT_FIELD_SEED} for defaults and Setup overlays.
 */
export function cloneStudentFieldSeed(): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = {};
  for (const [tabId, fields] of Object.entries(INITIAL_STUDENT_FIELD_SEED)) {
    next[tabId] = fields.map((field) => ({ ...field }));
  }
  return next;
}

/**
 * Normalize Students `settings.fields` to a tabbed Setup Fields map for column sync.
 * Flat legacy `{ fieldId: { enabled } }` overlays onto {@link INITIAL_STUDENT_FIELD_SEED}.
 */
export function resolveStudentFieldsMapForColumnSync(
  fields: Record<string, unknown> | undefined,
): Readonly<Record<string, FieldDefinition[]>> {
  if (!fields || typeof fields !== "object") {
    return cloneStudentFieldSeed();
  }
  const entries = Object.entries(fields);
  if (entries.length > 0 && entries.every(([, value]) => Array.isArray(value))) {
    return fields as Record<string, FieldDefinition[]>;
  }

  const flat = getFlatFieldsConfig(fields);
  const tabbed = cloneStudentFieldSeed();
  for (const tabFields of Object.values(tabbed)) {
    for (let index = 0; index < tabFields.length; index += 1) {
      const field = tabFields[index];
      const flags = flat[field.key];
      if (!flags) continue;
      tabFields[index] = {
        ...field,
        enabled: flags.enabled,
        required: flags.required || field.required,
      };
    }
  }
  return tabbed;
}

/**
 * Returns enabled non-seed fields for the Students form.
 * When `tabId` is specified, only fields stored under that config tab are returned.
 * When omitted, returns enabled non-seed fields from every tab.
 */
export function listEnabledCustomStudentFormFields<T extends FieldDefinition>(
  fields: Record<string, ReadonlyArray<T>>,
  tabId?: string,
): ReadonlyArray<T> {
  return helpers.listEnabledCustomFormFields(fields, tabId);
}

/**
 * Returns true when `fieldId` is part of the static form seed for `tabId`.
 */
export function isStudentSystemFormField(tabId: string, fieldId: string): boolean {
  return helpers.isSystemFormField(tabId, fieldId);
}

/**
 * Seeds Setup `defaultValue` for enabled scalar custom fields on new students only.
 * Does not overwrite keys already present on the draft.
 */
export function applyStudentScalarCustomFieldDefaults(
  draft: Partial<Student>,
  fields: Record<string, FieldDefinition[]> | undefined,
): Partial<Student> {
  if (!fields || typeof fields !== "object") return draft;
  if (draft.id != null && String(draft.id).length > 0) return draft;

  const next: Record<string, unknown> = { ...draft };
  const customFields = [
    ...listEnabledCustomStudentFormFields(fields, "basic"),
    ...listEnabledCustomStudentFormFields(fields, "registration"),
  ];
  for (const field of customFields) {
    if (Object.hasOwn(next, field.key)) continue;
    if (field.defaultValue === undefined || field.defaultValue === null) continue;
    next[field.key] = field.defaultValue;
  }
  return next as Partial<Student>;
}
