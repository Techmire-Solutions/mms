import type { FieldDefinition, TabDefinition } from "./contactTypes.js";
import { canViewContactField, canViewContactTab } from "./contactFieldAccess.js";
import type { FacultyMember } from "./facultyTypes.js";
import type { FacultySettings } from "./facultyModuleSettings.js";

export interface FacultyFieldConfigSnapshot {
  fields: Record<string, FieldDefinition[]>;
  tabs: TabDefinition[];
}

/**
 * Core faculty identity that stays visible regardless of the Setup field
 * registry (Work list + drawer must not break for restricted viewers).
 */
const FACULTY_ALWAYS_VISIBLE = new Set([
  "id",
  "contactId",
  "name",
  "employeeId",
  "status",
  "deletedAt",
  "deletedBy",
  "deletionReason",
]);

function isTabKeyedFieldRegistry(
  fields: FacultySettings["fields"],
): fields is Record<string, FieldDefinition[]> {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return false;
  const first = Object.values(fields)[0];
  return Array.isArray(first);
}

/**
 * Resolves faculty field keys that the viewer role cannot read.
 * Precomputed once per batch to avoid O(N * T * F) iterations and repeated tab finds.
 */
export function resolveFacultyKeysToStripForViewer(
  viewerRole: string,
  config: FacultyFieldConfigSnapshot,
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
      if (FACULTY_ALWAYS_VISIBLE.has(field.key)) continue;
      if (!tabVisible || field.enabled === false || !canViewContactField(viewerRole, field)) {
        toStrip.push(field.key);
      }
    }
  }
  return toStrip;
}

/**
 * Strips faculty properties the viewer role cannot read (API + restore guard).
 * Mirrors `sanitizeStudentForViewer`: disabled or role-hidden Setup fields are
 * removed; always-visible identity keys and unregistered custom keys survive.
 */
export function sanitizeFacultyForViewer(
  facultyMember: FacultyMember,
  viewerRole: string,
  config: FacultyFieldConfigSnapshot,
): FacultyMember {
  const keysToStrip = resolveFacultyKeysToStripForViewer(viewerRole, config);
  if (keysToStrip.length === 0) return facultyMember;
  const sanitized: FacultyMember = { ...facultyMember };
  for (const key of keysToStrip) {
    delete sanitized[key];
  }
  return sanitized;
}

export function sanitizeFacultyListForViewer(
  facultyList: FacultyMember[],
  viewerRole: string,
  config: FacultyFieldConfigSnapshot,
): FacultyMember[] {
  const keysToStrip = resolveFacultyKeysToStripForViewer(viewerRole, config);
  if (keysToStrip.length === 0) return facultyList;
  return facultyList.map((facultyMember) => {
    const sanitized: FacultyMember = { ...facultyMember };
    for (const key of keysToStrip) {
      delete sanitized[key];
    }
    return sanitized;
  });
}
