import { randomUUID } from "node:crypto";
import {
  type StudentRecord,
  normalizeStoredStudent,
  stripStudentClientSoftDeleteFields,
  stripStudentServerOwnedAuditFields,
} from "@mms/shared";
import { isUniqueViolation } from "../../lib/pgErrors.js";

function getPgConstraint(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const constraint =
    "constraint" in error ? String((error as { constraint?: unknown }).constraint ?? "") : "";
  if (constraint) return constraint;
  const cause = "cause" in error ? (error as { cause?: unknown }).cause : undefined;
  return getPgConstraint(cause);
}

/** Re-throws a unique violation as a 409 conflict (GR/studentId/contact duplicates). */
export function throwGrUniqueConflict(error: unknown): never {
  if (isUniqueViolation(error)) {
    const constraint = getPgConstraint(error).toLowerCase();
    let message = "A student with this GR number already exists.";
    let field = "grNumber";
    if (constraint.includes("student_id")) {
      message = "A student with this Student ID already exists.";
      field = "studentId";
    } else if (constraint.includes("contact")) {
      message = "A student profile is already linked to this contact.";
      field = "contact";
    }
    const conflict = new Error(message) as Error & {
      statusCode: number;
      type: string;
      field: string;
    };
    conflict.statusCode = 409;
    conflict.type = "conflict";
    conflict.field = field;
    throw conflict;
  }
  throw error;
}

/** Resolves a stable row id for creates (matches the legacy `st-<uuid>` prefix). */
export function resolveStudentRowId(id: unknown): string {
  if (typeof id === "string" && id.trim() !== "") {
    return id.trim();
  }
  if (typeof id === "number" && Number.isFinite(id)) {
    return String(id);
  }
  return `st-${randomUUID()}`;
}

/**
 * Merges a client patch onto an existing student row, ignoring undefined keys so
 * omitted optional fields survive (Contacts partial-PUT parity).
 */
export function mergeStudentPatch(
  existing: StudentRecord | Record<string, unknown>,
  patch: StudentRecord | Record<string, unknown>,
): StudentRecord | Record<string, unknown> {
  const next: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) next[key] = value;
  }
  return next;
}

/**
 * Parses + normalizes a write payload: strips client soft-delete metadata,
 * server-owned audit attribution/timestamps, and contact-owned identity keys.
 * Accepts pre-validated StudentRecord.
 */
export function prepareStudentRecord(
  record: StudentRecord | Record<string, unknown>,
): StudentRecord {
  const raw = record as Record<string, unknown>;
  const fatherContactId =
    raw.fatherContactId != null && String(raw.fatherContactId).trim() !== ""
      ? String(raw.fatherContactId).trim()
      : undefined;
  const motherContactId =
    raw.motherContactId != null && String(raw.motherContactId).trim() !== ""
      ? String(raw.motherContactId).trim()
      : undefined;
  const guardianContactId =
    raw.guardianContactId != null && String(raw.guardianContactId).trim() !== ""
      ? String(raw.guardianContactId).trim()
      : undefined;
  const grRaw = typeof raw.grNumber === "string" ? raw.grNumber.trim() : raw.grNumber;
  const studentIdRaw = typeof raw.studentId === "string" ? raw.studentId.trim() : raw.studentId;
  const withId = {
    ...raw,
    id: resolveStudentRowId(raw.id),
    fatherContactId,
    motherContactId,
    guardianContactId,
    fatherName: fatherContactId ? undefined : raw.fatherName,
    motherName: motherContactId ? undefined : raw.motherName,
    guardianName: guardianContactId ? undefined : raw.guardianName,
    // GR/Student-ID casing is preserved: templates may carry literal case (`GR{yy}{seq}`), and
    // uniqueness is already enforced case-insensitively by the `lower(btrim(...))` indexes.
    grNumber: grRaw,
    studentId: studentIdRaw,
  };
  // The read mapper emits a nested `customFields` map alongside the flattened keys. Accept it on
  // the wire (round-trips) but never persist it directly — the flattened keys are the write SSOT,
  // and writing the map would let a client bypass the strict allowlist.
  delete (withId as Record<string, unknown>).customFields;
  return normalizeStoredStudent(
    stripStudentServerOwnedAuditFields(
      stripStudentClientSoftDeleteFields(withId) as StudentRecord,
    ) as StudentRecord,
  );
}

/**
 * Raised when restoring a soft-deleted student would collide with an active
 * student's GR number. Routes map this to a 400 validation error (Contacts
 * restore parity).
 */
export class StudentRestoreConflictError extends Error {
  readonly type = "validation_error";
  readonly field: "grNumber" | "contact" | "studentId";

  constructor(
    message = "A student with this GR number already exists",
    field: "grNumber" | "contact" | "studentId" = "grNumber",
  ) {
    super(message);
    this.name = "StudentRestoreConflictError";
    this.field = field;
  }
}

/**
 * Raised when the *database* rejects a restore on a unique index — i.e. a concurrent writer claimed
 * the GR / Student-ID / contact between the pre-check and the write. §6.10 requires 409 for that
 * race; only the pre-validated conflicts are 400 (`StudentRestoreConflictError`).
 */
export class StudentRestoreRaceError extends Error {
  readonly statusCode = 409;
  readonly type = "conflict";
  readonly field: "grNumber" | "contact" | "studentId";

  constructor(
    field: "grNumber" | "contact" | "studentId" = "grNumber",
    message = "A concurrent change claimed this student's unique identifier. Reload and try again.",
  ) {
    super(message);
    this.name = "StudentRestoreRaceError";
    this.field = field;
  }
}

/**
 * Raised when a create reuses the id of an existing active student.
 *
 * Students persist through an upsert keyed on `(workspace_subdomain, id)`, so accepting the id
 * would silently overwrite that row. Routes map this to a 409 conflict on the `id` field.
 */
export class StudentCreateIdConflictError extends Error {
  readonly statusCode = 409;
  readonly type = "conflict";
  readonly field = "id";

  constructor(message = "A student with this ID already exists") {
    super(message);
    this.name = "StudentCreateIdConflictError";
  }
}

/**
 * Raised when re-registering a soft-deleted student would restore it without
 * delete permission. Routes map this to a 403 forbidden (Contacts restore
 * parity).
 */
export class StudentPermissionError extends Error {
  readonly code = "forbidden" as const;

  constructor(message = "Permission denied") {
    super(message);
    this.name = "StudentPermissionError";
  }
}
