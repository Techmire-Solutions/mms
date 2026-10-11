/**
 * @file sessionFormCustomFields.ts
 * @description Helpers for Sessions form custom (non-seed) fields.
 */
import { INITIAL_SESSIONS_FIELD_SEED } from "./moduleFieldSetupAcademic.js";
import { createFormCustomFieldHelpers } from "./createFormCustomFieldHelpers.js";
import type { FieldDefinition } from "./contactFieldSchemaTypes.js";

const helpers = createFormCustomFieldHelpers(INITIAL_SESSIONS_FIELD_SEED);

/**
 * Returns keys owned by static session form chrome (`INITIAL_SESSIONS_FIELD_SEED`).
 */
export function listSessionSystemFormFieldKeys(): ReadonlySet<string> {
  return helpers.listSystemFormFieldKeys();
}

/**
 * Returns enabled non-seed fields for the Sessions form.
 * When `tabId` is specified, only fields configured under that tab are returned.
 * When omitted, returns enabled non-seed fields across all tabs.
 */
export function listEnabledCustomSessionFormFields<T extends FieldDefinition>(
  fields: Record<string, ReadonlyArray<T>>,
  tabId?: string,
): ReadonlyArray<T> {
  return helpers.listEnabledCustomFormFields(fields, tabId);
}

/**
 * Returns true when `fieldId` is part of the static form seed for `tabId`.
 */
export function isSessionSystemFormField(tabId: string, fieldId: string): boolean {
  return helpers.isSystemFormField(tabId, fieldId);
}
