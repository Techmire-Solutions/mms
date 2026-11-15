import type { FieldDefinition, ModuleCustomField } from "@mms/shared";
import { validateCustomFieldValues } from "@/lib/forms/validateCustomFieldValues";

/** Widen tenant user custom fields to the registry field shape used by the shared validator. */
export function userCustomFieldsToRegistry(
  customFields: readonly ModuleCustomField[],
): FieldDefinition[] {
  return customFields
    .filter((field) => field.showInForm !== false)
    .map((field, index) => ({
      key: field.id,
      label: field.label,
      type: field.type,
      enabled: true,
      order: index,
      options: field.options,
      placeholder: field.placeholder,
      required: field.required,
    }));
}

/** Required/type/option validation for tenant user custom fields. */
export function validateUserCustomFields(
  customFields: readonly ModuleCustomField[],
  values: Record<string, unknown>,
  language: string,
): Record<string, string> {
  return validateCustomFieldValues(userCustomFieldsToRegistry(customFields), values, language);
}
