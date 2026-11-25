/**
 * @file facultyFormFieldMigration.ts
 * @description Legacy Faculty Setup field-key migration and product locks.
 */
import {
  INITIAL_FACULTY_FIELD_SEED,
  findFacultySeedField,
} from "../settings/moduleFieldSetupPersons.js";
import type { FieldDefinition } from "../contacts/contactFieldSchemaTypes.js";

const RETIRED_FACULTY_FORM_FIELDS = new Set([
  "specialization",
  "qualification",
  "hierarchyRank",
  "reportingFacultyId",
  "performanceRating",
  "profileStatus",
]);

/** Legacy seed keys renamed by the Faculty Management model; stored configs are remapped on read. */
const LEGACY_FACULTY_FIELD_KEY_RENAMES: Readonly<Record<string, string>> = {
  joinDate: "employmentStartDate",
  profileStatus: "employDesignationStatus",
};

/** Legacy seed keys with no successor (department now derives from the designation). */
const LEGACY_FACULTY_FIELD_KEYS_DROPPED = new Set(["department", "departmentId", "designation"]);

/** Fields whose enablement/required flags are product-owned and never overridable in Setup. */
const LOCKED_FACULTY_FIELD_FLAGS: Readonly<
  Record<string, { enabled: boolean; required: boolean }>
> = {
  contactId: { enabled: true, required: true },
  designationId: { enabled: true, required: true },
  designationStartDate: { enabled: true, required: true },
  employDesignationStatus: { enabled: true, required: true },
};

/** Canonical tab for a seed-owned field key (used to relocate misplaced stored fields). */
function facultySeedTabForKey(key: string): string | undefined {
  for (const [tabId, seedFields] of Object.entries(INITIAL_FACULTY_FIELD_SEED)) {
    if (seedFields.some((field) => field.key === key)) return tabId;
  }
  return undefined;
}

/** Remaps renamed keys, drops retired keys, relocates misplaced fields, and backfills seed gaps. */
function migrateLegacyFacultyFieldKeys(
  tabbed: Record<string, FieldDefinition[]>,
): Record<string, FieldDefinition[]> {
  const present = new Set<string>();
  const relocated: FieldDefinition[] = [];
  for (const [tabId, tabFields] of Object.entries(tabbed)) {
    const migrated: FieldDefinition[] = [];
    for (const field of tabFields) {
      if (LEGACY_FACULTY_FIELD_KEYS_DROPPED.has(field.key)) continue;
      const renamedKey = LEGACY_FACULTY_FIELD_KEY_RENAMES[field.key];
      const seedField = renamedKey ? findFacultySeedField(renamedKey) : undefined;
      const next = seedField
        ? {
            ...seedField,
            enabled: field.enabled,
            required: field.required ?? seedField.required,
            order: field.order,
          }
        : field;
      if (present.has(next.key)) continue;
      const canonicalTab = facultySeedTabForKey(next.key);
      if (canonicalTab && canonicalTab !== tabId) {
        present.add(next.key);
        relocated.push(next);
        continue;
      }
      present.add(next.key);
      migrated.push(next);
    }
    tabbed[tabId] = migrated;
  }
  for (const field of relocated) {
    const tabId = facultySeedTabForKey(field.key);
    if (!tabId) continue;
    const tabFields = tabbed[tabId] ?? (tabbed[tabId] = []);
    if (tabFields.some((existing) => existing.key === field.key)) continue;
    tabFields.push(field);
  }
  for (const [tabId, seedFields] of Object.entries(INITIAL_FACULTY_FIELD_SEED)) {
    const tabFields = tabbed[tabId] ?? (tabbed[tabId] = []);
    for (const seedField of seedFields) {
      if (present.has(seedField.key)) continue;
      present.add(seedField.key);
      tabFields.push({ ...seedField });
    }
  }
  return tabbed;
}

/** Product invariants after Setup overlays (legacy key migration; contact + designation compulsory; retired fields off). */
export function applyFacultyFieldProductLocks(
  tabbed: Record<string, FieldDefinition[]>,
): Record<string, FieldDefinition[]> {
  migrateLegacyFacultyFieldKeys(tabbed);
  for (const tabFields of Object.values(tabbed)) {
    for (let index = 0; index < tabFields.length; index += 1) {
      const field = tabFields[index];
      const locked = LOCKED_FACULTY_FIELD_FLAGS[field.key];
      if (locked) {
        tabFields[index] = { ...field, ...locked };
      } else if (RETIRED_FACULTY_FORM_FIELDS.has(field.key)) {
        tabFields[index] = { ...field, enabled: false, required: false };
      }
    }
  }
  return tabbed;
}
