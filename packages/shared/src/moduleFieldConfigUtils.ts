/**
 * Merges tabbed field configuration while preserving untouched default tabs.
 */
export function mergeTabbedFields(
  defaults: Record<string, unknown>,
  input?: Record<string, unknown>,
): Record<string, unknown> {
  if (!input) return defaults;
  const merged: Record<string, unknown> = { ...defaults };
  for (const [tab, fields] of Object.entries(input)) {
    if (Array.isArray(fields)) {
      merged[tab] = fields;
    } else if (fields && typeof fields === "object") {
      merged[tab] = {
        ...((merged[tab] as Record<string, unknown>) || {}),
        ...fields,
      };
    }
  }
  return merged;
}

/**
 * Flattens array- or map-based tab field configuration into field flags by key.
 */
export function getFlatFieldsConfig(
  fields?: Record<string, unknown>,
): Record<string, { enabled: boolean; required: boolean }> {
  const result: Record<string, { enabled: boolean; required: boolean }> = {};
  if (!fields) return result;

  const isDirectFlat = Object.values(fields).some(
    (val) =>
      val &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      ("enabled" in val || "required" in val),
  );
  if (isDirectFlat) {
    for (const [key, config] of Object.entries(fields)) {
      if (config && typeof config === "object" && !Array.isArray(config)) {
        const c = config as { enabled?: boolean; required?: boolean };
        result[key] = {
          enabled: c.enabled !== false,
          required: Boolean(c.required),
        };
      }
    }
    return result;
  }

  for (const list of Object.values(fields)) {
    if (Array.isArray(list)) {
      for (const field of list) {
        if (field && typeof field === "object" && "key" in field && typeof field.key === "string") {
          result[field.key] = {
            enabled: !("enabled" in field) || field.enabled !== false,
            required: "required" in field && Boolean(field.required),
          };
        }
      }
    } else if (list && typeof list === "object") {
      for (const [key, moduleFieldConfig] of Object.entries(list)) {
        if (moduleFieldConfig && typeof moduleFieldConfig === "object") {
          result[key] = {
            enabled: !("enabled" in moduleFieldConfig) || moduleFieldConfig.enabled !== false,
            required: "required" in moduleFieldConfig && Boolean(moduleFieldConfig.required),
          };
        }
      }
    }
  }
  return result;
}
