import { z } from "zod";
import type { FieldDefinition, TabDefinition } from "./contactTypes.js";
import { DEFAULT_USERS_SETTINGS, type UsersSettings } from "./usersModuleSettings.js";
import { USERS_TAB_REGISTRY, INITIAL_USERS_FIELD_SEED } from "./moduleFieldSetupPersons.js";
import { getFlatFieldsConfig } from "./moduleFieldConfigUtils.js";
import { moduleFieldConfigPutBodyBaseSchema } from "./schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "./schemas/sanitize.js";
import type { WorkspaceRole } from "./userEntityTypes.js";
import { DEFAULT_WORKSPACE_ROLES_MAP } from "./userRbacRegistry.js";
import { isSuperAdminRole } from "./userRoleUtils.js";

/** Deep clone {@link INITIAL_USERS_FIELD_SEED} for default and Setup states. */
export function cloneUsersFieldSeed(): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = {};
  for (const [tabId, fields] of Object.entries(INITIAL_USERS_FIELD_SEED)) {
    next[tabId] = fields.map((field) => ({ ...field }));
  }
  return next;
}

/** True when `fieldKey` is a core/system field within `tabId`'s seed. */
export function isUsersSystemFormField(tabId: string, fieldKey: string): boolean {
  return INITIAL_USERS_FIELD_SEED[tabId]?.some((field) => field.key === fieldKey) ?? false;
}

/** True when `tabKey` is a seed/system form tab for Users. */
export function isUsersSeedFormTab(tabKey: string): boolean {
  return USERS_TAB_REGISTRY.some((tab) => tab.key === tabKey);
}

/** True when `tabKey` is locked as enabled (Basic Account Info Setup tab). */
export function isUsersLockedEnabledTab(tabKey: string): boolean {
  return tabKey.toLowerCase() === "basic";
}

/**
 * Resolve Users `settings.fields` to a tabbed Setup Fields map.
 * Flat legacy `{ fieldId: { enabled, required } }` overlays onto {@link INITIAL_USERS_FIELD_SEED}.
 */
export function resolveUsersFieldsMap(
  fields: Record<string, unknown> | undefined,
): Record<string, FieldDefinition[]> {
  if (!fields || typeof fields !== "object") {
    return cloneUsersFieldSeed();
  }
  const entries = Object.entries(fields);
  if (entries.length > 0 && entries.every(([, value]) => Array.isArray(value))) {
    const tabbed = cloneUsersFieldSeed();
    for (const [tabId, tabFields] of entries) {
      tabbed[tabId] = Array.isArray(tabFields) ? (tabFields as FieldDefinition[]) : [];
    }
    for (const [tabId, seedFields] of Object.entries(INITIAL_USERS_FIELD_SEED)) {
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
  const tabbed = cloneUsersFieldSeed();
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

/** PUT /api/users/field-config — field registry JSON without formTabs SSOT. */
const userFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema
  .extend({
    columnRegistry: z.array(z.record(z.string(), z.unknown())).optional(),
    customFields: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .strict();

export const userFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, userFieldConfigPutBodyBaseSchema);

/** PUT /api/users/preferences — registration policy + workspace roles. */
export const userPreferencesPutBodySchema = z
  .object({
    allowSelfRegistration: z.boolean().optional(),
    requireEmailVerification: z.boolean().optional(),
    defaultViewLayout: z.string().optional(),
    workspaceRoles: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

export type UserModulePreferences = Pick<
  UsersSettings,
  "allowSelfRegistration" | "requireEmailVerification" | "defaultViewLayout" | "workspaceRoles"
>;

const PREF_KEYS = [
  "allowSelfRegistration",
  "requireEmailVerification",
  "defaultViewLayout",
  "workspaceRoles",
] as const;

export function normalizeWorkspaceRoles(
  raw: unknown,
  actorRole?: string,
): WorkspaceRole[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  let roles = raw.filter(
    (role): role is WorkspaceRole =>
      !!role &&
      typeof role === "object" &&
      !Array.isArray(role) &&
      typeof (role as { id?: unknown }).id === "string",
  );
  if (roles.length === 0) return undefined;

  // When actor is not Super Admin, preserve Super Admin role definition and full permissions
  if (actorRole && !isSuperAdminRole(actorRole)) {
    const defaultSuperAdmin = DEFAULT_WORKSPACE_ROLES_MAP["super_admin"];
    if (defaultSuperAdmin) {
      const hasSuperAdmin = roles.some((r) => isSuperAdminRole(r.id));
      if (!hasSuperAdmin) {
        roles = [defaultSuperAdmin, ...roles];
      } else {
        roles = roles.map((r) => (isSuperAdminRole(r.id) ? defaultSuperAdmin : r));
      }
    }
  }

  return roles;
}

/** Normalize Users module preferences (typed `user_module_preferences`). */
export function normalizeUserModulePreferences(
  partial?: Partial<UserModulePreferences> | Record<string, unknown> | null,
  actorRole?: string,
): UserModulePreferences {
  const defaults: UserModulePreferences = {
    allowSelfRegistration: DEFAULT_USERS_SETTINGS.allowSelfRegistration,
    requireEmailVerification: DEFAULT_USERS_SETTINGS.requireEmailVerification,
    defaultViewLayout: DEFAULT_USERS_SETTINGS.defaultViewLayout,
    workspaceRoles: DEFAULT_USERS_SETTINGS.workspaceRoles,
  };
  if (!partial || typeof partial !== "object") return { ...defaults };

  const workspaceRoles = normalizeWorkspaceRoles(partial.workspaceRoles, actorRole);

  return {
    allowSelfRegistration:
      typeof partial.allowSelfRegistration === "boolean"
        ? partial.allowSelfRegistration
        : defaults.allowSelfRegistration,
    requireEmailVerification:
      typeof partial.requireEmailVerification === "boolean"
        ? partial.requireEmailVerification
        : defaults.requireEmailVerification,
    defaultViewLayout:
      typeof partial.defaultViewLayout === "string" && partial.defaultViewLayout.trim()
        ? partial.defaultViewLayout.trim()
        : defaults.defaultViewLayout,
    workspaceRoles: workspaceRoles ?? defaults.workspaceRoles,
  };
}

/** Field-config slice persisted on `user_field_configs` (never formTabs / module prefs). */
export function stripUserFieldConfigForPersist(
  config: UsersSettings | Record<string, unknown>,
): Record<string, unknown> {
  const {
    formTabs: _formTabs,
    allowSelfRegistration: _allowSelfRegistration,
    requireEmailVerification: _requireEmailVerification,
    defaultViewLayout: _defaultViewLayout,
    workspaceRoles: _workspaceRoles,
    ...rest
  } = config as UsersSettings & Record<string, unknown>;
  return rest;
}

/** Normalize UsersSettings from typed REST or legacy document blobs. */
export function normalizeUsersSettings(config: unknown): UsersSettings {
  const defaults = { ...DEFAULT_USERS_SETTINGS, formTabs: [...USERS_TAB_REGISTRY] };
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ...defaults };
  }
  const raw = config as Record<string, unknown>;
  const prefs = normalizeUserModulePreferences(raw);
  return {
    ...defaults,
    ...(raw as Partial<UsersSettings>),
    ...prefs,
    customFields: Array.isArray(raw.customFields)
      ? (raw.customFields as UsersSettings["customFields"])
      : defaults.customFields,
    fieldOrder: Array.isArray(raw.fieldOrder) ? (raw.fieldOrder as string[]) : defaults.fieldOrder,
    formTabs: Array.isArray(raw.formTabs) ? (raw.formTabs as TabDefinition[]) : defaults.formTabs,
    enabledTabs: Array.isArray(raw.enabledTabs)
      ? (raw.enabledTabs as string[])
      : (raw.enabledTabs as string[] | undefined),
    requiredTabs: Array.isArray(raw.requiredTabs)
      ? (raw.requiredTabs as string[])
      : (raw.requiredTabs as string[] | undefined),
    fields: resolveUsersFieldsMap(
      raw.fields && typeof raw.fields === "object" && !Array.isArray(raw.fields)
        ? (raw.fields as Record<string, unknown>)
        : undefined,
    ),
  };
}

/** Split a legacy `users_settings` blob into typed field-config + preferences rows. */
export function splitUsersSettingsBlob(raw: unknown): {
  fieldConfig: Record<string, unknown>;
  preferences: UserModulePreferences;
} {
  const settings = normalizeUsersSettings(raw);
  return {
    fieldConfig: stripUserFieldConfigForPersist(settings),
    preferences: normalizeUserModulePreferences(settings),
  };
}

/** Compose FE/validation UsersSettings from typed parts (+ optional custom tabs). */
export function composeUsersSettings(
  fieldConfig: unknown,
  preferences: unknown,
  formTabs?: TabDefinition[],
): UsersSettings {
  const prefs = normalizeUserModulePreferences(
    preferences as Partial<UserModulePreferences> | null,
  );
  return normalizeUsersSettings({
    ...(fieldConfig && typeof fieldConfig === "object" && !Array.isArray(fieldConfig)
      ? (fieldConfig as Record<string, unknown>)
      : {}),
    ...prefs,
    ...(formTabs ? { formTabs } : {}),
  });
}

/**
 * Merge API custom_tabs with document/default form tabs for Users Setup/forms.
 */
export function mergeUsersFormTabsFromApi(
  documentFormTabs: TabDefinition[] | undefined,
  apiTabs: TabDefinition[],
  _fields?: Record<string, FieldDefinition[]> | undefined,
): TabDefinition[] {
  const documentOrDefault =
    documentFormTabs && documentFormTabs.length > 0 ? documentFormTabs : [...USERS_TAB_REGISTRY];

  const merged =
    apiTabs.length === 0
      ? documentOrDefault
      : [
          ...apiTabs,
          ...USERS_TAB_REGISTRY.filter(
            (seedTab) => !apiTabs.some((apiTab) => apiTab.key === seedTab.key),
          ),
        ];

  const seenKeys = new Set<string>();
  return merged.filter((tab) => {
    if (!tab?.key || seenKeys.has(tab.key)) return false;
    seenKeys.add(tab.key);
    return true;
  });
}

export { PREF_KEYS as USER_MODULE_PREFERENCE_KEYS };
