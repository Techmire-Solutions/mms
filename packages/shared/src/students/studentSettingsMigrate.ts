import {
  DEFAULT_STUDENT_ENABLED_TABS,
  DEFAULT_STUDENT_REQUIRED_TABS,
  INITIAL_STUDENT_FIELD_SEED,
  STUDENT_TAB_REGISTRY,
} from "../settings/settingsTypes.js";
import type { FieldDefinition, TabDefinition } from "../contacts/contactTypes.js";
import type { StudentsSettings } from "../settings/settingsTypes.js";
import {
  refreshModuleTierTabKeys,
  refreshModuleTierTabLabels,
} from "../settings/moduleTierTabs.js";

const OBSOLETE_STUDENT_SETUP_TABS = new Set(["guardian", "academic"]);
export const OBSOLETE_STUDENT_GUARDIAN_FIELD_KEYS = new Set([
  "fatherLink",
  "motherLink",
  "guardianLink",
]);
export const STUDENT_SETTINGS_VERSION = 5;

function isLegacyFlatFields(fields: unknown): boolean {
  if (!fields || typeof fields !== "object") return false;
  const values = Object.values(fields);
  if (values.length === 0) return false;
  return !Array.isArray(values[0]);
}

function normalizeTabs(tabs: unknown): StudentsSettings["formTabs"] | undefined {
  if (!Array.isArray(tabs)) return undefined;
  const result: TabDefinition[] = [];
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    if (!tab || typeof tab !== "object") continue;
    const tabRecord = tab as Record<string, unknown>;
    const key =
      typeof tabRecord.key === "string" && tabRecord.key
        ? tabRecord.key
        : typeof tabRecord.id === "string"
          ? tabRecord.id
          : `tab_${i}`;
    const label = typeof tabRecord.label === "string" ? tabRecord.label : key;
    result.push({
      key,
      label,
      enabled: typeof tabRecord.enabled === "boolean" ? tabRecord.enabled : true,
      order: typeof tabRecord.order === "number" ? tabRecord.order : i,
      ...(typeof tabRecord.icon === "string" ? { icon: tabRecord.icon } : {}),
      ...(typeof tabRecord.description === "string" ? { description: tabRecord.description } : {}),
      ...(typeof tabRecord.color === "string" ? { color: tabRecord.color } : {}),
      ...(typeof tabRecord.isSystem === "boolean" ? { isSystem: tabRecord.isSystem } : {}),
    });
  }
  return result;
}

function mergeFieldLists(
  primary: FieldDefinition[],
  incoming: FieldDefinition[],
): FieldDefinition[] {
  const merged = [...primary];
  for (const field of incoming) {
    if (merged.some((existing) => existing.key === field.key)) continue;
    merged.push({ ...field });
  }
  merged.forEach((field, index) => {
    field.order = index;
  });
  return merged;
}

/** Collapse guardian → basic and academic → registration (Setup Fields v3). */
function migrateStudentSetupFieldsToTwoTabs(
  fields: Record<string, FieldDefinition[]>,
): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = { ...fields };
  const basic = mergeFieldLists(next.basic ?? [], next.guardian ?? []);
  const registration = mergeFieldLists(next.registration ?? [], next.academic ?? []);
  next.basic = basic;
  next.registration = registration;
  delete next.guardian;
  delete next.academic;
  return next;
}

/** Replace father/mother/guardian triad with single contactRelationships field. */
function migrateStudentGuardianLinkFields(
  fields: Record<string, FieldDefinition[]>,
): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = {};
  let enableRelationships = false;
  let sawObsolete = false;

  for (const [tabId, tabFields] of Object.entries(fields)) {
    const kept: FieldDefinition[] = [];
    for (const field of tabFields ?? []) {
      if (OBSOLETE_STUDENT_GUARDIAN_FIELD_KEYS.has(field.key)) {
        sawObsolete = true;
        if (field.enabled !== false) enableRelationships = true;
        continue;
      }
      kept.push(field);
    }
    next[tabId] = kept;
  }

  const basic = [...(next.basic ?? [])];
  const hasContactRelationships = basic.some((field) => field.key === "contactRelationships");
  if (!hasContactRelationships) {
    const seed = INITIAL_STUDENT_FIELD_SEED.basic?.find(
      (field) => field.key === "contactRelationships",
    );
    if (seed) {
      basic.push({
        ...seed,
        enabled: sawObsolete ? enableRelationships : seed.enabled,
        order: basic.length,
      });
    }
  } else if (sawObsolete && enableRelationships) {
    for (const field of basic) {
      if (field.key === "contactRelationships") field.enabled = true;
    }
  }
  basic.forEach((field, index) => {
    field.order = index;
  });
  next.basic = basic;
  return next;
}

function remapStudentEnabledTabs(tabs: string[] | undefined): string[] {
  const source = tabs ?? [];
  const out: string[] = [];
  let hadAcademic = false;
  for (const tab of source) {
    if (tab === "guardian") continue;
    if (tab === "academic") {
      hadAcademic = true;
      continue;
    }
    if (!out.includes(tab)) out.push(tab);
  }
  if (hadAcademic && !out.includes("registration")) {
    out.push("registration");
  }
  if (out.length === 0) {
    return [...DEFAULT_STUDENT_ENABLED_TABS];
  }
  return out;
}

function remapStudentRequiredTabs(tabs: string[] | undefined): string[] {
  if (!tabs || tabs.length === 0) return [...DEFAULT_STUDENT_REQUIRED_TABS];
  return remapStudentEnabledTabs(tabs);
}

function rebuildStudentFormTabs(existing: TabDefinition[] | undefined): TabDefinition[] {
  const registryKeys = new Set(STUDENT_TAB_REGISTRY.map((tab) => tab.key));
  const extras = (normalizeTabs(existing) ?? []).filter(
    (tab) => !registryKeys.has(tab.key) && !OBSOLETE_STUDENT_SETUP_TABS.has(tab.key),
  );
  return refreshModuleTierTabLabels(refreshModuleTierTabKeys([...STUDENT_TAB_REGISTRY, ...extras]));
}

/** Inject missing INITIAL_STUDENT_FIELD_SEED keys without wiping customs. */
function ensureStudentSeedFields(
  fields: Record<string, FieldDefinition[]>,
): Record<string, FieldDefinition[]> {
  const next: Record<string, FieldDefinition[]> = { ...fields };

  for (const [tabId, seedFields] of Object.entries(INITIAL_STUDENT_FIELD_SEED)) {
    const current = [...(next[tabId] ?? [])];
    const existingKeys = new Set(current.map((field) => field.key));
    const missing = seedFields
      .filter((seed) => !existingKeys.has(seed.key))
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

    let inserted = false;
    for (const seed of missing) {
      const lowerSeedKeys = new Set(
        seedFields
          .filter((candidate) => (candidate.order ?? 0) < (seed.order ?? 0))
          .map((candidate) => candidate.key),
      );
      let insertAt = current.length;
      let foundLower = false;
      for (let index = current.length - 1; index >= 0; index -= 1) {
        const field = current[index];
        if (field && lowerSeedKeys.has(field.key)) {
          insertAt = index + 1;
          foundLower = true;
          break;
        }
      }
      if (!foundLower) {
        insertAt = Math.min(seed.order ?? 0, current.length);
      }
      current.splice(insertAt, 0, { ...seed });
      inserted = true;
    }

    const seedByKey = new Map(seedFields.map((seed) => [seed.key, seed]));
    for (const field of current) {
      const seed = seedByKey.get(field.key);
      if (!seed) continue;
      if (!field.labelKey && seed.labelKey) field.labelKey = seed.labelKey;
      if (!field.descriptionKey && seed.descriptionKey) field.descriptionKey = seed.descriptionKey;
      if (!field.description && seed.description) field.description = seed.description;
      // Domain lock: student rows always link a contact.
      if (field.key === "contactId") {
        field.enabled = true;
        field.required = true;
      }
    }

    if (inserted) {
      current.forEach((field, index) => {
        field.order = index;
      });
    }
    next[tabId] = current;
  }

  return next;
}

/** Apply Setup Fields tab collapse + guardian triad → contactRelationships (v4) + full form seed (v5). */
export function applyStudentSetupVersionMigrate(draft: Partial<StudentsSettings>): void {
  const storedVersion = typeof draft.version === "number" ? draft.version : 0;

  if (draft.fields && typeof draft.fields === "object" && !isLegacyFlatFields(draft.fields)) {
    let fields = draft.fields as Record<string, FieldDefinition[]>;
    if (fields.guardian || fields.academic) {
      fields = migrateStudentSetupFieldsToTwoTabs(fields);
    }
    draft.fields = ensureStudentSeedFields(migrateStudentGuardianLinkFields(fields));
  }

  if (storedVersion >= STUDENT_SETTINGS_VERSION) {
    return;
  }

  draft.enabledTabs = remapStudentEnabledTabs(draft.enabledTabs);
  draft.requiredTabs = remapStudentRequiredTabs(draft.requiredTabs);
  draft.formTabs = rebuildStudentFormTabs(draft.formTabs);
  draft.version = STUDENT_SETTINGS_VERSION;
}

export { isLegacyFlatFields, normalizeTabs };
