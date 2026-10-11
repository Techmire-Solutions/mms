import type { FieldDefinition, TabDefinition } from "@mms/shared";

/** Stable field shape for dirty detection — ignores undefined vs false noise from buildFieldsMap. */
export function canonicalizeField(field: FieldDefinition): Record<string, unknown> {
  const key = field.key || "";
  const canonical: Record<string, unknown> = {
    key,
    enabled: Boolean(field.enabled),
    required: Boolean(field.required),
    unique: Boolean(field.unique),
    order: typeof field.order === "number" ? field.order : 999,
  };
  if (typeof field.label === "string") canonical.label = field.label;
  if (typeof field.labelKey === "string") canonical.labelKey = field.labelKey;
  if (typeof field.type === "string") canonical.type = field.type;
  if (typeof field.description === "string") canonical.description = field.description;
  if (typeof field.descriptionKey === "string") canonical.descriptionKey = field.descriptionKey;
  if (Array.isArray(field.options)) canonical.options = field.options;
  if (field.defaultValue !== undefined) canonical.defaultValue = field.defaultValue;
  if (Array.isArray(field.permissions)) canonical.permissions = field.permissions;
  if (typeof field.placeholder === "string") canonical.placeholder = field.placeholder;
  return canonical;
}

export function fieldsForTab(
  fields: Record<string, FieldDefinition[]> | undefined,
  tabKey: string,
): FieldDefinition[] {
  const source = fields || {};
  const direct = source[tabKey];
  if (Array.isArray(direct)) return direct;
  const lower = tabKey.toLowerCase();
  for (const [key, list] of Object.entries(source)) {
    if (key.toLowerCase() === lower && Array.isArray(list)) return list;
  }
  return [];
}

/**
 * Only form-tab fields; orphan config.fields tabs are ignored (buildFieldsMap drops them).
 * Relative order only — buildFieldsMap rewrites absolute order to 0..n.
 */
export function canonicalizeFieldsMap(
  fields: Record<string, FieldDefinition[]> | undefined,
  formTabs: TabDefinition[],
): Record<string, Record<string, unknown>[]> {
  const next: Record<string, Record<string, unknown>[]> = {};
  const tabs = [...formTabs].sort((a, b) => a.key.toLowerCase().localeCompare(b.key.toLowerCase()));
  for (const tab of tabs) {
    const tabKey = tab.key.toLowerCase();
    next[tabKey] = fieldsForTab(fields, tab.key)
      .slice()
      .sort(
        (a, b) => (a.order ?? 999) - (b.order ?? 999) || String(a.key).localeCompare(String(b.key)),
      )
      .map((field, index) => {
        const canonical = canonicalizeField(field);
        canonical.order = index;
        return canonical;
      });
  }
  return next;
}
