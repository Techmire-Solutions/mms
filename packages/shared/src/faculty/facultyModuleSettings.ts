import type {
  TabDefinition,
  ColumnRegistryEntry,
  FieldDefinition,
} from "../contacts/contactTypes.js";
import type { ModuleFieldDef } from "../settings/moduleFieldSchema.js";
import { INITIAL_FACULTY_FIELD_SEED } from "../settings/moduleFieldSetupPersons.js";
import { DEFAULT_FACULTY_SPECIALIZATION } from "./facultyTypes.js";
import { facultyFieldLabelKey } from "./facultyDirectoryColumns.js";
import {
  cloneFacultyFieldSeed,
  listEnabledCustomFacultyFormFields,
  listFacultySystemFormFieldKeys,
  resolveFacultyFieldsMapForColumnSync,
} from "./facultyFormCustomFields.js";

// ─── Faculty Module Settings ──────────────────────────────────────────────────

export interface FacultyFieldConfig {
  enabled?: boolean;
  required?: boolean;
}

/** Legacy compat shape — read-only bridge; tabbed `fields` is the write SSOT. */
export interface FacultyCustomField {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
}

/**
 * Configuration for the Faculty module.
 * Field registry + prefs live on typed `faculty_field_configs` / `faculty_module_preferences`.
 * Work directory view uses `useWorkDirectoryViewMode`.
 * `fields` is a tabbed `Record<tabId, FieldDefinition[]>` (flat legacy blobs still accepted on read).
 */
export interface FacultySettings {
  idPrefix: string;
  autoGenerateId: boolean;
  requireContactLink: boolean;
  defaultSpecialization: string;
  idTemplate?: string;
  idDigits?: number;
  idStartSeq?: number;
  idRestartAnnually?: boolean;
  employeeIdPrefix?: string;
  employeeIdYearFormat?: "YYYY" | "YY";
  employeeIdSequenceDigits?: number;
  employeeIdDelimiter?: string;
  employeeIdLastYear?: number;
  employeeIdCurrentSequence?: number;
  fields?: Record<string, unknown>;
  fieldOrder?: string[];
  formTabs?: TabDefinition[];
  enabledTabs?: string[];
  requiredTabs?: string[];
  columnRegistry?: ColumnRegistryEntry[];
}

function defaultFacultyFieldOrderFromSeed(): string[] {
  return Object.values(INITIAL_FACULTY_FIELD_SEED).flatMap((tabFields) =>
    [...tabFields]
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .map((field) => field.key),
  );
}

function facultyFieldDefFromDefinition(field: FieldDefinition, isCustom: boolean): FacultyFieldDef {
  return {
    id: field.key,
    labelKey: field.labelKey ?? facultyFieldLabelKey(field.key),
    label: field.label,
    type: field.type,
    required: Boolean(field.required),
    options: field.options,
    enabled: field.enabled !== false,
    isCustom,
  };
}

/** Authoritative default values for FacultySettings (tabbed Fields SSOT). */
export const DEFAULT_FACULTY_SETTINGS: FacultySettings = {
  idPrefix: "FAC",
  idTemplate: "{PREFIX}{YYYY}{SEQ}",
  idDigits: 4,
  idStartSeq: 1,
  idRestartAnnually: false,
  employeeIdPrefix: "FAC",
  employeeIdYearFormat: "YYYY",
  employeeIdSequenceDigits: 4,
  employeeIdDelimiter: "",
  employeeIdCurrentSequence: 0,
  employeeIdLastYear: 2026,
  autoGenerateId: true,
  requireContactLink: true,
  defaultSpecialization: DEFAULT_FACULTY_SPECIALIZATION,
  fields: cloneFacultyFieldSeed(),
  fieldOrder: defaultFacultyFieldOrderFromSeed(),
};

export interface FacultyFieldDef extends ModuleFieldDef {
  labelKey?: string;
  isCustom?: boolean;
}

const seedFieldsByKey = new Map(
  Object.values(INITIAL_FACULTY_FIELD_SEED)
    .flat()
    .map((field) => [field.key, field]),
);

/** Seed system field defs in seed order (from tabbed {@link INITIAL_FACULTY_FIELD_SEED}). */
export const DEFAULT_FACULTY_FIELD_DEFS: ReadonlyArray<FacultyFieldDef> = Object.freeze(
  defaultFacultyFieldOrderFromSeed().map((fieldId) => {
    const field = seedFieldsByKey.get(fieldId);
    if (!field) {
      throw new Error(`Faculty seed missing system field: ${fieldId}`);
    }
    return facultyFieldDefFromDefinition(field, false);
  }),
);

/**
 * Returns sorted faculty field definitions (system + custom) from tabbed `fields` only.
 */
export function getSortedFacultyFields(
  fieldOrder?: ReadonlyArray<string> | string[],
  fieldsRaw?: unknown,
): FacultyFieldDef[] {
  const tabbed = resolveFacultyFieldsMapForColumnSync(
    fieldsRaw && typeof fieldsRaw === "object" && !Array.isArray(fieldsRaw)
      ? (fieldsRaw as Record<string, unknown>)
      : undefined,
  );
  const systemKeys = listFacultySystemFormFieldKeys();
  const seenKeys = new Set<string>();
  const fieldDefinitions: FacultyFieldDef[] = [];

  for (const tabFields of Object.values(tabbed)) {
    for (const field of tabFields) {
      if (systemKeys.has(field.key) && !seenKeys.has(field.key)) {
        seenKeys.add(field.key);
        fieldDefinitions.push(facultyFieldDefFromDefinition(field, false));
      }
    }
  }

  for (const field of listEnabledCustomFacultyFormFields(tabbed)) {
    if (!seenKeys.has(field.key)) {
      seenKeys.add(field.key);
      fieldDefinitions.push(facultyFieldDefFromDefinition(field, true));
    }
  }

  const order = fieldOrder || DEFAULT_FACULTY_SETTINGS.fieldOrder || [];
  const orderIndexByFieldId = Object.fromEntries(order.map((fieldId, index) => [fieldId, index]));
  return fieldDefinitions.sort((left, right) => {
    const leftIndex = orderIndexByFieldId[left.id] ?? 9999;
    const rightIndex = orderIndexByFieldId[right.id] ?? 9999;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return left.id.localeCompare(right.id);
  });
}
