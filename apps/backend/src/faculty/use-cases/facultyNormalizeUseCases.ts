import { randomUUID } from "node:crypto";
import {
  normalizeStoredFaculty,
  stripFacultyClientSoftDeleteFields,
  type FacultyRecord,
} from "@mms/shared";

/** Client-supplied soft-delete metadata must never reach storage. */
export { normalizeStoredFaculty, stripFacultyClientSoftDeleteFields };

/** Resolves a stable row id for creates (`fac-<uuid>` prefix). */
export function resolveFacultyRowId(id: unknown): string {
  if (typeof id === "string" && id.trim() !== "") {
    return id.trim();
  }
  if (typeof id === "number" && Number.isFinite(id)) {
    return String(id);
  }
  return `fac-${randomUUID()}`;
}

/**
 * Merges a client patch onto an existing faculty row, ignoring undefined keys so
 * omitted optional fields survive (Contacts/Students partial-PUT parity).
 */
export function mergeFacultyPatch(
  existing: FacultyRecord | Record<string, unknown>,
  patch: FacultyRecord | Record<string, unknown>,
): FacultyRecord | Record<string, unknown> {
  const next: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) next[key] = value;
  }
  return next;
}

/**
 * Parses + normalizes a write payload: strips client soft-delete metadata and
 * contact-owned profile keys. Accepts pre-validated FacultyRecord.
 */
export function prepareFacultyRecord(
  record: FacultyRecord | Record<string, unknown>,
): FacultyRecord {
  const raw: Record<string, unknown> = { ...record };
  // customDesignation is create-bootstrap catalog UX only — not a faculty column.
  delete raw.customDesignation;
  const withId = {
    ...raw,
    id: resolveFacultyRowId(raw.id),
  };
  return normalizeStoredFaculty(stripFacultyClientSoftDeleteFields(withId) as FacultyRecord);
}
