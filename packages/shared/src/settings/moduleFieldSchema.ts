/** Shared module field configuration schema used across module settings. */

// ─── Customizable Form Fields Schema ──────────────────────────────────────────

export interface ModuleFieldConfig {
  enabled: boolean;
  required: boolean;
}

export interface ModuleCustomField {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "boolean" | "date" | "url" | "email" | "tags";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  description?: string;
  defaultValue?: string;
  showInForm?: boolean;
  unique?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  mask?: string;
}

export interface ModuleFieldDef {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  enabled?: boolean;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  unique?: boolean;
}

/**
 * Returns a sorted list of all module field definitions (default & custom)
 * based on the saved display sequence order in settings.
 *
 * @param defaultDefs The default field definitions of the module
 * @param fieldOrder The saved sequence of field IDs
 * @param fieldsConfig The toggled enable/required state for default fields
 * @param customFields Custom fields created by the user
 */
export function getSortedFields(
  defaultDefs: readonly ModuleFieldDef[],
  fieldOrder: string[] | undefined,
  fieldsConfig: Record<string, ModuleFieldConfig> | undefined,
  customFields: ModuleCustomField[] | undefined,
): ModuleFieldDef[] {
  const defaultFieldDefinitions = defaultDefs.map((fieldDefinition) => {
    const fieldConfig = fieldsConfig?.[fieldDefinition.id] || {
      enabled: true,
      required: !!fieldDefinition.required,
    };
    return {
      ...fieldDefinition,
      enabled: fieldConfig.enabled,
      required: fieldConfig.required,
    };
  });

  const customFieldDefinitions = (customFields || []).map((customField) => ({
    id: customField.id,
    label: customField.label,
    type: customField.type,
    required: !!customField.required,
    options: customField.options,
    placeholder: customField.placeholder,
    description: customField.description,
    defaultValue: customField.defaultValue,
    unique: customField.unique,
    enabled: true,
  }));

  const fieldDefinitions = [...defaultFieldDefinitions, ...customFieldDefinitions];
  const order = fieldOrder || defaultDefs.map((fieldDefinition) => fieldDefinition.id);
  const orderIndexByFieldId = Object.fromEntries(order.map((fieldId, index) => [fieldId, index]));

  return fieldDefinitions.sort((leftField, rightField) => {
    const leftOrderIndex = orderIndexByFieldId[leftField.id] ?? 9999;
    const rightOrderIndex = orderIndexByFieldId[rightField.id] ?? 9999;
    return leftOrderIndex - rightOrderIndex;
  });
}
