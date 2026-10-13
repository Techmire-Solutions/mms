import type { FieldDefinition, TabDefinition } from "../contacts/contactTypes.js";
import { canViewContactField, canViewContactTab } from "../contacts/contactFieldAccess.js";
import type { Student } from "./studentTypes.js";
import type { StudentsSettings } from "./studentsModuleSettings.js";

interface StudentsFieldConfigSnapshot {
  fields: Record<string, FieldDefinition[]>;
  tabs: TabDefinition[];
}

/**
 * Core student identity that stays visible regardless of the Setup field
 * registry (Work list + drawer must not break for restricted viewers).
 */
const STUDENT_ALWAYS_VISIBLE = new Set([
  "id",
  "contactId",
  "name",
  "grNumber",
  "studentId",
  "status",
  "deletedAt",
  "deletedBy",
  "deletionReason",
]);

function isTabKeyedFieldRegistry(
  fields: StudentsSettings["fields"],
): fields is Record<string, FieldDefinition[]> {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return false;
  const first = Object.values(fields)[0];
  return Array.isArray(first);
}

/**
 * Resolves student field keys that the viewer role cannot read.
 * Precomputed once per batch to avoid O(N * T * F) iterations and repeated tab finds.
 */
export function resolveStudentKeysToStripForViewer(
  viewerRole: string,
  config: StudentsFieldConfigSnapshot,
): string[] {
  if (!config?.fields || !isTabKeyedFieldRegistry(config.fields)) return [];
  const tabMap = new Map<string, TabDefinition>();
  for (const candidate of config.tabs ?? []) {
    if (candidate.key) {
      tabMap.set(candidate.key.toLowerCase(), candidate);
    }
  }

  const toStrip: string[] = [];
  for (const [tabId, tabFields] of Object.entries(config.fields)) {
    const tab = tabMap.get(tabId.toLowerCase());
    const tabVisible = tab ? canViewContactTab(viewerRole, tab) : true;
    for (const field of tabFields) {
      if (STUDENT_ALWAYS_VISIBLE.has(field.key)) continue;
      if (!tabVisible || field.enabled === false || !canViewContactField(viewerRole, field)) {
        toStrip.push(field.key);
      }
    }
  }
  return toStrip;
}

/**
 * Strips student properties the viewer role cannot read (API + restore guard).
 * Mirrors `sanitizeContactForViewer`: disabled or role-hidden Setup fields are
 * removed; always-visible identity keys and unregistered custom keys survive.
 */
export function sanitizeStudentForViewer(
  student: Student,
  viewerRole: string,
  config: StudentsFieldConfigSnapshot,
): Student {
  const keysToStrip = resolveStudentKeysToStripForViewer(viewerRole, config);
  if (keysToStrip.length === 0) return student;
  const sanitized: Student = { ...student };
  for (const key of keysToStrip) {
    delete sanitized[key];
  }
  return sanitized;
}

export function sanitizeStudentsForViewer(
  students: Student[],
  viewerRole: string,
  config: StudentsFieldConfigSnapshot,
): Student[] {
  const keysToStrip = resolveStudentKeysToStripForViewer(viewerRole, config);
  if (keysToStrip.length === 0) return students;
  return students.map((student) => {
    const sanitized: Student = { ...student };
    for (const key of keysToStrip) {
      delete sanitized[key];
    }
    return sanitized;
  });
}
