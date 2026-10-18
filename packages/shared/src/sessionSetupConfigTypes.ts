import { z } from 'zod';
import type { FieldDefinition, TabDefinition } from './contactTypes.js';
import {
  DEFAULT_SESSIONS_SETTINGS,
  type SessionsSettings,
} from './sessionsModuleSettings.js';
import {
  SESSIONS_TAB_REGISTRY,
  INITIAL_SESSIONS_FIELD_SEED,
} from './moduleFieldSetupAcademic.js';
import { getFlatFieldsConfig } from './moduleFieldConfigUtils.js';
import { moduleFieldConfigPutBodyBaseSchema } from './schemas/moduleFieldConfig.dto.js';
import { deepSanitizeStrings } from './schemas/sanitize.js';
import { normalizeSessionsViewLayout } from './sessionsExportUtils.js';
import { academicTerminologySchema, normalizeAcademicTerminology, type AcademicTerminology } from './academicTerminology.js';

/** Deep clone {@link INITIAL_SESSIONS_FIELD_SEED} for default and Setup states. */
export function cloneSessionFieldSeed(): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = {};
  for (const [tabId, fields] of Object.entries(INITIAL_SESSIONS_FIELD_SEED)) {
    next[tabId] = fields.map((field) => ({ ...field }));
  }
  return next;
}

/** True when `tabKey` is a seed/system form tab for Sessions. */
export function isSessionSeedFormTab(tabKey: string): boolean {
  return SESSIONS_TAB_REGISTRY.some((tab) => tab.key === tabKey);
}

/** True when `tabKey` is locked as enabled (Basic Info tab). */
export function isSessionLockedEnabledTab(tabKey: string): boolean {
  return tabKey.toLowerCase() === 'basic';
}

/**
 * Resolve Sessions `settings.fields` to a tabbed Setup Fields map.
 * Flat legacy `{ fieldId: { enabled, required } }` overlays onto {@link INITIAL_SESSIONS_FIELD_SEED}.
 */
export function resolveSessionsFieldsMap(
  fields: Record<string, unknown> | undefined,
): Record<string, FieldDefinition[]> {
  if (!fields || typeof fields !== 'object') {
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

/** PUT /api/sessions/field-config — field registry JSON without formTabs SSOT. */
const sessionFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema
  .extend({
    columnRegistry: z.array(z.record(z.string(), z.unknown())).optional(),
    customFields: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .strict();

export const sessionFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, sessionFieldConfigPutBodyBaseSchema);

/** PUT /api/sessions/preferences — academic/session prefs only. */
export const sessionPreferencesPutBodySchema = z
  .object({
    defaultDuration: z.string().optional(),
    defaultSessionType: z.string().optional(),
    allowOverlap: z.boolean().optional(),
    archiveOldSessions: z.boolean().optional(),
    requireBudget: z.boolean().optional(),
    timetableConflictCheck: z.boolean().optional(),
    notifyOnSessionStart: z.boolean().optional(),
    academicYear: z.string().optional(),
    sessionStart: z.string().optional(),
    defaultViewLayout: z.string().optional(),
    terminology: academicTerminologySchema.optional(),
  })
  .passthrough();

export type SessionModulePreferences = { terminology: AcademicTerminology } & Pick<
  SessionsSettings,
  | 'defaultDuration'
  | 'defaultSessionType'
  | 'allowOverlap'
  | 'archiveOldSessions'
  | 'requireBudget'
  | 'timetableConflictCheck'
  | 'notifyOnSessionStart'
  | 'academicYear'
  | 'sessionStart'
  | 'defaultViewLayout'
>;

const PREF_KEYS = [
  'defaultDuration',
  'defaultSessionType',
  'allowOverlap',
  'archiveOldSessions',
  'requireBudget',
  'timetableConflictCheck',
  'notifyOnSessionStart',
  'academicYear',
  'sessionStart',
  'defaultViewLayout',
  'terminology',
] as const;

/** Normalize Sessions module preferences (typed `session_module_preferences`). */
export function normalizeSessionModulePreferences(
  partial?: Partial<SessionModulePreferences> | Record<string, unknown> | null,
): SessionModulePreferences {
  const defaults: SessionModulePreferences = {
    defaultDuration: DEFAULT_SESSIONS_SETTINGS.defaultDuration,
    defaultSessionType: DEFAULT_SESSIONS_SETTINGS.defaultSessionType,
    allowOverlap: DEFAULT_SESSIONS_SETTINGS.allowOverlap,
    archiveOldSessions: DEFAULT_SESSIONS_SETTINGS.archiveOldSessions,
    requireBudget: DEFAULT_SESSIONS_SETTINGS.requireBudget,
    timetableConflictCheck: DEFAULT_SESSIONS_SETTINGS.timetableConflictCheck,
    notifyOnSessionStart: DEFAULT_SESSIONS_SETTINGS.notifyOnSessionStart,
    academicYear: DEFAULT_SESSIONS_SETTINGS.academicYear,
    sessionStart: DEFAULT_SESSIONS_SETTINGS.sessionStart,
    defaultViewLayout: DEFAULT_SESSIONS_SETTINGS.defaultViewLayout,
    terminology: {},
  };
  if (!partial || typeof partial !== 'object') return { ...defaults };

  return {
    defaultDuration:
      typeof partial.defaultDuration === 'string' && partial.defaultDuration.trim()
        ? partial.defaultDuration.trim()
        : defaults.defaultDuration,
    defaultSessionType:
      typeof partial.defaultSessionType === 'string' && partial.defaultSessionType.trim()
        ? partial.defaultSessionType.trim()
        : defaults.defaultSessionType,
    allowOverlap:
      typeof partial.allowOverlap === 'boolean' ? partial.allowOverlap : defaults.allowOverlap,
    archiveOldSessions:
      typeof partial.archiveOldSessions === 'boolean'
        ? partial.archiveOldSessions
        : defaults.archiveOldSessions,
    requireBudget:
      typeof partial.requireBudget === 'boolean' ? partial.requireBudget : defaults.requireBudget,
    timetableConflictCheck:
      typeof partial.timetableConflictCheck === 'boolean'
        ? partial.timetableConflictCheck
        : defaults.timetableConflictCheck,
    notifyOnSessionStart:
      typeof partial.notifyOnSessionStart === 'boolean'
        ? partial.notifyOnSessionStart
        : defaults.notifyOnSessionStart,
    academicYear:
      typeof partial.academicYear === 'string' && partial.academicYear.trim()
        ? partial.academicYear.trim()
        : defaults.academicYear,
    sessionStart:
      typeof partial.sessionStart === 'string' && partial.sessionStart.trim()
        ? partial.sessionStart.trim()
        : defaults.sessionStart,
    defaultViewLayout: normalizeSessionsViewLayout(
      typeof partial.defaultViewLayout === 'string'
        ? partial.defaultViewLayout
        : defaults.defaultViewLayout,
    ),
    terminology: normalizeAcademicTerminology((partial as Record<string, unknown>).terminology),
  };
}

/** Field-config slice persisted on `session_field_configs` (never formTabs / module prefs). */
export function stripSessionFieldConfigForPersist(
  config: SessionsSettings | Record<string, unknown>,
): Record<string, unknown> {
  const {
    formTabs: _formTabs,
    defaultDuration: _defaultDuration,
    defaultSessionType: _defaultSessionType,
    allowOverlap: _allowOverlap,
    archiveOldSessions: _archiveOldSessions,
    requireBudget: _requireBudget,
    timetableConflictCheck: _timetableConflictCheck,
    notifyOnSessionStart: _notifyOnSessionStart,
    academicYear: _academicYear,
    sessionStart: _sessionStart,
    defaultViewLayout: _defaultViewLayout,
    terminology: _terminology,
    ...rest
  } = config as SessionsSettings & Record<string, unknown>;
  return rest;
}

/** Normalize SessionsSettings from typed REST or legacy document blobs. */
export function normalizeSessionsSettings(config: unknown): SessionsSettings {
  const defaults = { ...DEFAULT_SESSIONS_SETTINGS, formTabs: [...SESSIONS_TAB_REGISTRY] };
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { ...defaults };
  }
  const raw = config as Record<string, unknown>;
  const prefs = normalizeSessionModulePreferences(raw);
  return {
    ...defaults,
    ...(raw as Partial<SessionsSettings>),
    ...prefs,
    customFields: Array.isArray(raw.customFields)
      ? (raw.customFields as SessionsSettings['customFields'])
      : defaults.customFields,
    fieldOrder: Array.isArray(raw.fieldOrder)
      ? (raw.fieldOrder as string[])
      : defaults.fieldOrder,
    formTabs: Array.isArray(raw.formTabs)
      ? (raw.formTabs as TabDefinition[])
      : defaults.formTabs,
    enabledTabs: Array.isArray(raw.enabledTabs)
      ? (raw.enabledTabs as string[])
      : (raw.enabledTabs as string[] | undefined),
    requiredTabs: Array.isArray(raw.requiredTabs)
      ? (raw.requiredTabs as string[])
      : (raw.requiredTabs as string[] | undefined),
    fields: resolveSessionsFieldsMap(
      raw.fields && typeof raw.fields === 'object' && !Array.isArray(raw.fields)
        ? (raw.fields as Record<string, unknown>)
        : undefined,
    ),
  };
}

/** Split a legacy `sessions_settings` blob into typed field-config + preferences rows. */
export function splitSessionsSettingsBlob(raw: unknown): {
  fieldConfig: Record<string, unknown>;
  preferences: SessionModulePreferences;
} {
  const settings = normalizeSessionsSettings(raw);
  return {
    fieldConfig: stripSessionFieldConfigForPersist(settings),
    preferences: normalizeSessionModulePreferences(settings),
  };
}

/** Compose FE/validation SessionsSettings from typed parts (+ optional custom tabs). */
export function composeSessionsSettings(
  fieldConfig: unknown,
  preferences: unknown,
  formTabs?: TabDefinition[],
): SessionsSettings {
  const prefs = normalizeSessionModulePreferences(
    preferences as Partial<SessionModulePreferences> | null,
  );
  return normalizeSessionsSettings({
    ...(fieldConfig && typeof fieldConfig === 'object' && !Array.isArray(fieldConfig)
      ? (fieldConfig as Record<string, unknown>)
      : {}),
    ...prefs,
    ...(formTabs ? { formTabs } : {}),
  });
}

/**
 * Merge API custom_tabs with document/default form tabs for Sessions Setup/forms.
 */
export function mergeSessionsFormTabsFromApi(
  documentFormTabs: TabDefinition[] | undefined,
  apiTabs: TabDefinition[],
  _fields?: Record<string, FieldDefinition[]> | undefined,
): TabDefinition[] {
  const documentOrDefault =
    documentFormTabs && documentFormTabs.length > 0
      ? documentFormTabs
      : [...SESSIONS_TAB_REGISTRY];

  const merged =
    apiTabs.length === 0
      ? documentOrDefault
      : [
          ...apiTabs,
          ...SESSIONS_TAB_REGISTRY.filter(
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

export { PREF_KEYS as SESSION_MODULE_PREFERENCE_KEYS };
