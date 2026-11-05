/** Sessions Setup field-registry resolution (seed clone + tabbed/flat normalization). */
import type { FieldDefinition } from "../contacts/contactTypes.js";
import { INITIAL_SESSIONS_FIELD_SEED } from "../settings/moduleFieldSetupAcademic.js";
import { getFlatFieldsConfig } from "../settings/moduleFieldConfigUtils.js";

/** Deep clone {@link INITIAL_SESSIONS_FIELD_SEED} for default and Setup states. */
function cloneSessionFieldSeed(): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = {};
  for (const [tabId, fields] of Object.entries(INITIAL_SESSIONS_FIELD_SEED)) {
    next[tabId] = fields.map((field) => ({ ...field }));
  }
  return next;
}

/**
 * Resolve Sessions `settings.fields` to a tabbed Setup Fields map.
 * Flat legacy `{ fieldId: { enabled, required } }` overlays onto {@link INITIAL_SESSIONS_FIELD_SEED}.
 */
export function resolveSessionsFieldsMap(
  fields: Record<string, unknown> | undefined,
): Record<string, FieldDefinition[]> {
  if (!fields || typeof fields !== "object") {
    return cloneSessionFieldSeed();
  }
  const entries = Object.entries(fields);
  if (entries.length > 0 && entries.every(([, value]) => Array.isArray(value))) {
    const tabbed = cloneSessionFieldSeed();
    for (const [tabId, tabFields] of entries) {
      tabbed[tabId] = Array.isArray(tabFields) ? (tabFields as FieldDefinition[]) : [];
    }
    for (const [tabId, seedFields] of Object.entries(INITIAL_SESSIONS_FIELD_SEED)) {
      if (!tabbed[tabId]) {
        tabbed[tabId] = seedFields.map((f) => ({ ...f }));
      } else {
        const existingKeys = new Set(tabbed[tabId].map((f) => f.key));
        for (const seedField of seedFields) {
          if (!existingKeys.has(seedField.key)) {
            tabbed[tabId].push({ ...seedField });
          }
        }
      }
    }
    return tabbed;
  }

  const flat = getFlatFieldsConfig(fields);
  const tabbed = cloneSessionFieldSeed();
  for (const tabFields of Object.values(tabbed)) {
    for (let index = 0; index < tabFields.length; index += 1) {
      const field = tabFields[index];
      const flags = flat[field.key];
      if (!flags) continue;
      tabFields[index] = {
        ...field,
        enabled: flags.enabled !== false,
        required: flags.required ?? field.required,
      };
    }
  }
  return tabbed;
}
