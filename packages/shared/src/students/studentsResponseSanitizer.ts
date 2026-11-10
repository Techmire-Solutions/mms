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

export interface StudentClearanceOptions {
  canViewNotes?: boolean;
  canViewMedical?: boolean;
  canViewIep?: boolean;
  canViewSensitivePii?: boolean;
}

/** Masks a national ID (CNIC/SSN) preserving only trailing digits: `***-**-1234`. */
export function maskNationalId(val?: string | null): string | undefined {
  if (!val) return undefined;
  const str = String(val).trim();
  if (str.length <= 4) return "****";
  return `***-**-${str.slice(-4)}`;
}

/** Known confidential clinical, psychiatric, or IEP keys to shield from standard viewers. */
const CONFIDENTIAL_PII_KEYS = [
  "medicalNotes",
  "physicianNotes",
  "psychologicalEvaluation",
  "iepDetails",
  "specialEducationDetails",
  "behavioralPlan",
  "disciplinaryHistory",
] as const;

/**
 * Removes `keysToStrip` from a student record — both at the top level and inside the nested
 * `customFields` map.
 *
 * Reads flatten `custom_fields` onto the record but keep the map
 * (`studentRepositoryMappers.studentRowToRecord`), so deleting only the top-level key would still
 * expose a restricted custom value through `customFields`.
 */
function stripStudentKeys(
  student: Student,
  keysToStrip: readonly string[],
  clearance?: StudentClearanceOptions,
  viewerRole?: string,
): Student {
  const sanitized: Student = { ...student };
  for (const key of keysToStrip) {
    delete sanitized[key];
  }
  const customFields = (student as { customFields?: unknown }).customFields;
  if (customFields && typeof customFields === "object" && !Array.isArray(customFields)) {
    const nextCustomFields = { ...(customFields as Record<string, unknown>) };
    let removed = false;
    for (const key of keysToStrip) {
      if (key in nextCustomFields) {
        delete nextCustomFields[key];
        removed = true;
      }
    }
    if (removed) {
      (sanitized as Record<string, unknown>).customFields = nextCustomFields;
    }
  }

  // Apply clearance-based masking and redaction
  const normalizedRole = (viewerRole ?? "").trim().toLowerCase();
  const isAdminTier = ["super_admin", "admin", "principal", "registrar", "super_user"].includes(
    normalizedRole,
  );

  const canViewNotes = clearance?.canViewNotes ?? (isAdminTier || normalizedRole === "teacher");
  const canViewMedical = clearance?.canViewMedical ?? isAdminTier;
  const canViewIep = clearance?.canViewIep ?? isAdminTier;
  const canViewSensitivePii = clearance?.canViewSensitivePii ?? isAdminTier;

  if (!canViewNotes && sanitized.notes !== undefined) {
    delete sanitized.notes;
  }

  if (!canViewSensitivePii) {
    if (sanitized.cnic) {
      sanitized.cnic = maskNationalId(sanitized.cnic);
    }
    const cFields = (sanitized as { customFields?: Record<string, unknown> }).customFields;
    if (cFields && typeof cFields.cnic === "string") {
      cFields.cnic = maskNationalId(cFields.cnic);
    }
  }

  if (!canViewMedical || !canViewIep) {
    const cFields = (sanitized as { customFields?: Record<string, unknown> }).customFields;
    for (const k of CONFIDENTIAL_PII_KEYS) {
      delete sanitized[k];
      if (cFields && k in cFields) {
        delete cFields[k];
      }
    }
    // If medicalConditions exists but user cannot view medical details, convert to safe boolean flag
    if (!canViewMedical) {
      if (Array.isArray(sanitized.medicalConditions) && sanitized.medicalConditions.length > 0) {
        sanitized.hasMedicalAlert = true;
      }
      delete sanitized.medicalConditions;
    }
  }

  return sanitized;
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
  clearance?: StudentClearanceOptions,
): Student {
  const keysToStrip = resolveStudentKeysToStripForViewer(viewerRole, config);
  return stripStudentKeys(student, keysToStrip, clearance, viewerRole);
}

export function sanitizeStudentsForViewer(
  students: Student[],
  viewerRole: string,
  config: StudentsFieldConfigSnapshot,
  clearance?: StudentClearanceOptions,
): Student[] {
  const keysToStrip = resolveStudentKeysToStripForViewer(viewerRole, config);
  return students.map((student) => stripStudentKeys(student, keysToStrip, clearance, viewerRole));
}
