import type { Student } from "@mms/shared";
import type { Contact } from "@mms/shared";
import { sanitizeAuditState } from "./auditTrailService.js";

/**
 * Captures user-authored textual content from a student record immediately
 * before archival so the forensic record survives any future hard-purge.
 *
 * Only free-text / user-authored fields are captured.
 * PII credentials and system metadata are stripped via sanitizeAuditState.
 */
export function buildStudentForensicSnapshot(student: Student): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    id: student.id,
    notes: student.notes ?? null,
    // Custom data may contain user-authored text blobs from Setup custom fields
    customData: (student as Record<string, unknown>)["customData"] ?? null,
  };
  return sanitizeAuditState(raw) as Record<string, unknown>;
}

/**
 * Captures user-authored textual content from a contact record immediately
 * before archival.
 */
export function buildContactForensicSnapshot(contact: Contact): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    id: contact.id,
    notes: contact.notes ?? null,
    customData: (contact as Record<string, unknown>)["customData"] ?? null,
  };
  return sanitizeAuditState(raw) as Record<string, unknown>;
}
