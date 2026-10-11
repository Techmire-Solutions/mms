/** Accounting Setup field-registry resolution (seed clone + tabbed/flat normalization). */
import type { FieldDefinition } from "./contactTypes.js";
import {
  ACCOUNTING_TAB_REGISTRY,
  INITIAL_ACCOUNTING_FIELD_SEED,
} from "./moduleFieldSetupFinance.js";
import { getFlatFieldsConfig } from "./moduleFieldConfigUtils.js";

/** Deep clone {@link INITIAL_ACCOUNTING_FIELD_SEED} for default and Setup states. */
export function cloneAccountingFieldSeed(): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = {};
  for (const [tabId, fields] of Object.entries(INITIAL_ACCOUNTING_FIELD_SEED)) {
    next[tabId] = fields.map((field) => ({ ...field }));
  }
  return next;
}

/** True when `fieldKey` is a core/system field within `tabId`'s seed. */
export function isAccountingSystemFormField(tabId: string, fieldKey: string): boolean {
  return INITIAL_ACCOUNTING_FIELD_SEED[tabId]?.some((field) => field.key === fieldKey) ?? false;
}

/** True when `tabKey` is a seed/system form tab for Accounting. */
export function isAccountingSeedFormTab(tabKey: string): boolean {
  return ACCOUNTING_TAB_REGISTRY.some((tab) => tab.key === tabKey);
}

/** True when `tabKey` is locked as enabled (Basic Setup tab). */
export function isAccountingLockedEnabledTab(tabKey: string): boolean {
  return tabKey.toLowerCase() === "basic";
}

/**
 * Resolve Accounting `settings.fields` to a tabbed Setup Fields map.
 * Flat legacy `{ fieldId: { enabled, required } }` overlays onto {@link INITIAL_ACCOUNTING_FIELD_SEED}.
 */
export function resolveAccountingFieldsMap(
  fields: Record<string, unknown> | undefined,
): Record<string, FieldDefinition[]> {
  if (!fields || typeof fields !== "object") {
    return cloneAccountingFieldSeed();
  }
  const entries = Object.entries(fields);
  if (entries.length > 0 && entries.every(([, value]) => Array.isArray(value))) {
    const tabbed = cloneAccountingFieldSeed();
    for (const [tabId, tabFields] of entries) {
      tabbed[tabId] = Array.isArray(tabFields) ? (tabFields as FieldDefinition[]) : [];
    }
    for (const [tabId, seedFields] of Object.entries(INITIAL_ACCOUNTING_FIELD_SEED)) {
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
  const tabbed = cloneAccountingFieldSeed();
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
