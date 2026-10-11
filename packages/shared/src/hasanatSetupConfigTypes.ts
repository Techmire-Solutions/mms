import { z } from "zod";
import type { FieldDefinition, TabDefinition } from "./contactTypes.js";
import { DEFAULT_HASANAT_SETTINGS, type HasanatSettings } from "./hasanatModuleSettings.js";
import { moduleFieldConfigPutBodyBaseSchema } from "./schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "./schemas/sanitize.js";
import { HASANAT_TAB_REGISTRY, INITIAL_HASANAT_FIELD_SEED } from "./moduleFieldSetupFinance.js";
import { getFlatFieldsConfig } from "./moduleFieldConfigUtils.js";

/** Deep clone {@link INITIAL_HASANAT_FIELD_SEED} for default and Setup states. */
export function cloneHasanatFieldSeed(): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = {};
  for (const [tabId, fields] of Object.entries(INITIAL_HASANAT_FIELD_SEED)) {
    next[tabId] = fields.map((field) => ({ ...field }));
  }
  return next;
}

/** True when `fieldKey` is a core/system field within `tabId`'s seed. */
export function isHasanatSystemFormField(tabId: string, fieldKey: string): boolean {
  return INITIAL_HASANAT_FIELD_SEED[tabId]?.some((field) => field.key === fieldKey) ?? false;
}

/** True when `tabKey` is a seed/system form tab for Hasanat. */
export function isHasanatSeedFormTab(tabKey: string): boolean {
  return HASANAT_TAB_REGISTRY.some((tab) => tab.key === tabKey);
}

/** True when `tabKey` is locked as enabled (Basic Info tab). */
export function isHasanatLockedEnabledTab(tabKey: string): boolean {
  return tabKey.toLowerCase() === "basic";
}

/**
 * Resolve Hasanat `settings.fields` to a tabbed Setup Fields map.
 * Flat legacy `{ fieldId: { enabled, required } }` overlays onto {@link INITIAL_HASANAT_FIELD_SEED}.
 */
export function resolveHasanatFieldsMap(
  fields: Record<string, unknown> | undefined,
): Record<string, FieldDefinition[]> {
  if (!fields || typeof fields !== "object") {
    return cloneHasanatFieldSeed();
  }
  const entries = Object.entries(fields);
  if (entries.length > 0 && entries.every(([, value]) => Array.isArray(value))) {
    const tabbed = cloneHasanatFieldSeed();
    for (const [tabId, tabFields] of entries) {
      tabbed[tabId] = Array.isArray(tabFields) ? (tabFields as FieldDefinition[]) : [];
    }
    for (const [tabId, seedFields] of Object.entries(INITIAL_HASANAT_FIELD_SEED)) {
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
  const tabbed = cloneHasanatFieldSeed();
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

/** PUT /api/hasanat/field-config — field registry JSON without prefs keys. */
const hasanatFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema
  .extend({
    customFields: z.array(z.record(z.string(), z.unknown())).optional(),
    fieldOrder: z.array(z.string()).optional(),
    formTabs: z.array(z.record(z.string(), z.unknown())).optional(),
    enabledTabs: z.array(z.string()).optional(),
    requiredTabs: z.array(z.string()).optional(),
  })
  .strict();

export const hasanatFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, hasanatFieldConfigPutBodyBaseSchema);

/** PUT /api/hasanat/preferences — hasanat prefs only. */
export const hasanatPreferencesPutBodySchema = z
  .object({
    pointsPerUnit: z.number().optional(),
    autoApprovePayouts: z.boolean().optional(),
    defaultViewLayout: z.string().optional(),
  })
  .passthrough();

/** Typed preference state extracted from legacy HasanatSettings. */
export interface HasanatModulePreferences {
  pointsPerUnit: number;
  autoApprovePayouts: boolean;
  defaultViewLayout: string;
}

/** Extracts preferences slice from a raw composed settings blob. */
export function normalizeHasanatModulePreferences(raw: unknown): HasanatModulePreferences {
  if (!raw || typeof raw !== "object") {
    return {
      pointsPerUnit: DEFAULT_HASANAT_SETTINGS.pointsPerUnit,
      autoApprovePayouts: DEFAULT_HASANAT_SETTINGS.autoApprovePayouts,
      defaultViewLayout: DEFAULT_HASANAT_SETTINGS.defaultViewLayout || "list",
    };
  }

  const prefs = raw as Partial<HasanatModulePreferences>;
  return {
    pointsPerUnit:
      typeof prefs.pointsPerUnit === "number"
        ? prefs.pointsPerUnit
        : DEFAULT_HASANAT_SETTINGS.pointsPerUnit,
    autoApprovePayouts:
      typeof prefs.autoApprovePayouts === "boolean"
        ? prefs.autoApprovePayouts
        : DEFAULT_HASANAT_SETTINGS.autoApprovePayouts,
    defaultViewLayout:
      typeof prefs.defaultViewLayout === "string"
        ? prefs.defaultViewLayout
        : DEFAULT_HASANAT_SETTINGS.defaultViewLayout || "list",
  };
}

/** Extracts field-config slice from a raw composed settings blob. */
export function normalizeHasanatSettings(raw: unknown): HasanatSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_HASANAT_SETTINGS };
  }

  const safe = raw as Partial<HasanatSettings>;
  return {
    pointsPerUnit: DEFAULT_HASANAT_SETTINGS.pointsPerUnit, // managed by preferences
    autoApprovePayouts: DEFAULT_HASANAT_SETTINGS.autoApprovePayouts, // managed by preferences
    defaultViewLayout: DEFAULT_HASANAT_SETTINGS.defaultViewLayout, // managed by preferences
    fields: resolveHasanatFieldsMap(
      safe.fields && typeof safe.fields === "object" && !Array.isArray(safe.fields)
        ? (safe.fields as Record<string, unknown>)
        : undefined,
    ),
    customFields: safe.customFields ?? DEFAULT_HASANAT_SETTINGS.customFields ?? [],
    fieldOrder: safe.fieldOrder ?? DEFAULT_HASANAT_SETTINGS.fieldOrder ?? [],
    formTabs: safe.formTabs,
    enabledTabs: safe.enabledTabs,
    requiredTabs: safe.requiredTabs,
  };
}

/** Recomposes preferences and field-config into the legacy flat settings shape. */
export function composeHasanatSettings(
  fieldConfig: HasanatSettings | null,
  prefs: HasanatModulePreferences,
  formTabs?: TabDefinition[],
): HasanatSettings {
  return {
    ...(fieldConfig ?? DEFAULT_HASANAT_SETTINGS),
    pointsPerUnit: prefs.pointsPerUnit,
    autoApprovePayouts: prefs.autoApprovePayouts,
    defaultViewLayout: prefs.defaultViewLayout,
    formTabs: formTabs ?? fieldConfig?.formTabs,
  };
}

/** Drops preference keys before saving field-config to avoid overriding prefs layer. */
export function stripHasanatFieldConfigForPersist(
  config: Partial<HasanatSettings>,
): Partial<HasanatSettings> {
  const {
    pointsPerUnit: _p,
    autoApprovePayouts: _a,
    defaultViewLayout: _d,
    ...fieldConfigOnly
  } = config;
  return fieldConfigOnly;
}

export function mergeHasanatFormTabsFromApi(
  documentFormTabs: TabDefinition[] | undefined,
  apiTabs: TabDefinition[],
): TabDefinition[] {
  const base =
    documentFormTabs && documentFormTabs.length > 0 ? documentFormTabs : [...HASANAT_TAB_REGISTRY];
  const merged =
    apiTabs.length === 0
      ? base
      : [
          ...apiTabs,
          ...HASANAT_TAB_REGISTRY.filter(
            (s: TabDefinition) => !apiTabs.some((a) => a.key === s.key),
          ),
        ];
  const seen = new Set<string>();
  return merged.filter((tab) => {
    if (!tab?.key || seen.has(tab.key)) return false;
    seen.add(tab.key);
    return true;
  });
}
