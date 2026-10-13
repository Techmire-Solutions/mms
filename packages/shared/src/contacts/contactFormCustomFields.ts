/** Helpers for contact form custom (non-seed) fields. */
import { INITIAL_FIELD_SEED } from "./contactFieldSeed.js";
import { REMOVED_FORM_FIELD_KEYS } from "./contactTabRegistry.js";
import { createFormCustomFieldHelpers } from "../core/createFormCustomFieldHelpers.js";
import type { FieldDefinition } from "./contactFieldSchemaTypes.js";

const helpers = createFormCustomFieldHelpers(INITIAL_FIELD_SEED);
const removedKeySet = new Set(REMOVED_FORM_FIELD_KEYS);

/**
 * Enabled non-seed fields for the contact form.
 * When `tabId` is set, only fields stored under that config tab are returned
 * (so a field created on Basic stays on Basic).
 * When omitted, returns enabled non-seed fields from every tab (legacy aggregate).
 */
export function listEnabledCustomContactFormFields<T extends FieldDefinition>(
  fields: Record<string, ReadonlyArray<T>>,
  tabId?: string,
): ReadonlyArray<T> {
  return helpers
    .listEnabledCustomFormFields(fields, tabId)
    .filter((field) => !removedKeySet.has(field.key));
}
