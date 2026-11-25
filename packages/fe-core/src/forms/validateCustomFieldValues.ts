import { buildCustomFieldSchema, type FieldDefinition } from "@mms/contracts";

/**
 * Validates tenant custom-field values against their registry FieldDefinition.
 *
 * Uses the same compiler as the dynamic Contacts/Students/Faculty schemas, so
 * required/type/option/min-max rules and their localized messages cannot drift
 * between modules.
 */
export function validateCustomFieldValues(
  fields: ReadonlyArray<FieldDefinition>,
  values: Record<string, unknown>,
  language: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.enabled === false) continue;
    const result = buildCustomFieldSchema(field, language).safeParse(values[field.key]);
    if (result.success) continue;
    errors[field.key] = result.error.issues[0]?.message ?? "";
  }
  return errors;
}
