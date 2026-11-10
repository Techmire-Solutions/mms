import {
  normalizeStudentsSettings,
  sanitizeStudentForViewer as sanitizeStudentRecord,
  sanitizeStudentsForViewer as sanitizeStudentRecords,
  type FieldDefinition,
  type Student,
  type StudentClearanceOptions,
  type StudentsSettings,
  type TabDefinition,
} from "@mms/shared";
import { loadStudentFieldConfig } from "./studentConfigService.js";

interface StudentsFieldConfigSnapshot {
  fields: Record<string, FieldDefinition[]>;
  tabs: TabDefinition[];
}

function settingsSnapshot(settings: StudentsSettings | null): StudentsFieldConfigSnapshot | null {
  if (!settings) return null;
  const fields =
    settings.fields && typeof settings.fields === "object" && !Array.isArray(settings.fields)
      ? (settings.fields as Record<string, FieldDefinition[]>)
      : undefined;
  if (!fields) return null;
  return {
    fields,
    tabs: settings.formTabs ?? [],
  };
}

/**
 * Field-visibility snapshot used by the viewer sanitizer.
 *
 * A workspace that has never saved Setup → Fields has no row; falling through with the raw record
 * (the previous behaviour) made field permissions unenforceable for exactly those tenants. The
 * seeded defaults are the tenant's published configuration in that case, so they are used instead
 * (contacts C-10 parity).
 */
function resolveSnapshot(settings: StudentsSettings | null): StudentsFieldConfigSnapshot {
  return settingsSnapshot(settings) ?? settingsSnapshot(normalizeStudentsSettings(null))!;
}

/** Strips student properties the viewer role cannot read (field-config + viewer role + PII clearance). */
export async function sanitizeStudentForViewer(
  student: Student,
  viewerRole: string,
  clearance?: StudentClearanceOptions,
): Promise<Student> {
  return sanitizeStudentRecord(
    student,
    viewerRole,
    resolveSnapshot(await loadStudentFieldConfig()),
    clearance,
  );
}

export async function sanitizeStudentsForViewer(
  students: Student[],
  viewerRole: string,
  clearance?: StudentClearanceOptions,
): Promise<Student[]> {
  return sanitizeStudentRecords(
    students,
    viewerRole,
    resolveSnapshot(await loadStudentFieldConfig()),
    clearance,
  );
}
