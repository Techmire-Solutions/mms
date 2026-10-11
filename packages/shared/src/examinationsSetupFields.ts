/** Examinations Setup field-registry resolution (seed clone + tabbed/flat normalization). */
import type { FieldDefinition } from "./contactTypes.js";
import {
  EXAMINATIONS_TAB_REGISTRY,
  INITIAL_EXAMINATIONS_FIELD_SEED,
} from "./moduleFieldSetupAcademic.js";
import { getFlatFieldsConfig } from "./moduleFieldConfigUtils.js";

/** Deep clone {@link INITIAL_EXAMINATIONS_FIELD_SEED} for default and Setup states. */
export function cloneExaminationFieldSeed(): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = {};
  for (const [tabId, fields] of Object.entries(INITIAL_EXAMINATIONS_FIELD_SEED)) {
    next[tabId] = fields.map((field) => ({ ...field }));
  }
  return next;
}

/** True when `fieldKey` is a core/system field within `tabId`'s seed. */
export function isExaminationSystemFormField(tabId: string, fieldKey: string): boolean {
  return INITIAL_EXAMINATIONS_FIELD_SEED[tabId]?.some((field) => field.key === fieldKey) ?? false;
}

/** True when `tabKey` is a seed/system form tab for Examinations. */
export function isExaminationSeedFormTab(tabKey: string): boolean {
  return EXAMINATIONS_TAB_REGISTRY.some((tab) => tab.key === tabKey);
}

/** True when `tabKey` is locked as enabled (Basic Info tab). */
export function isExaminationLockedEnabledTab(tabKey: string): boolean {
  return tabKey.toLowerCase() === "basic";
}

/**
 * Resolve Examinations `settings.fields` to a tabbed Setup Fields map.
 * Flat legacy `{ fieldId: { enabled, required } }` overlays onto {@link INITIAL_EXAMINATIONS_FIELD_SEED}.
 */
export function resolveExaminationFieldsMap(
  fields: Record<string, unknown> | undefined,
): Record<string, FieldDefinition[]> {
  if (!fields || typeof fields !== "object") {
    return cloneExaminationFieldSeed();
  }
  const entries = Object.entries(fields);
  if (entries.length > 0 && entries.every(([, value]) => Array.isArray(value))) {
    const tabbed = cloneExaminationFieldSeed();
    for (const [tabId, tabFields] of entries) {
      tabbed[tabId] = Array.isArray(tabFields) ? (tabFields as FieldDefinition[]) : [];
    }
    for (const [tabId, seedFields] of Object.entries(INITIAL_EXAMINATIONS_FIELD_SEED)) {
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
  const tabbed = cloneExaminationFieldSeed();
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
