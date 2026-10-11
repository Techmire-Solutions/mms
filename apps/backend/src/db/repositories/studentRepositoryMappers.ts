import { type Student, type StudentStatus } from "@mms/shared";
import { type students } from "../schema.js";
import { mapAuditTimestamps, nullsToUndefined, parseNumericColumn } from "./repositoryMappers.js";

export function studentRowToRecord(
  row: typeof students.$inferSelect,
  enrolledSessionRows: Array<{ sessionId: string; sortOrder: number }> = [],
): Student {
  const enrolledSessions = enrolledSessionRows
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => s.sessionId);

  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    deletedAt: _deletedAt,
    deletedBy: _deletedBy,
    deletionReason: _deletionReason,
    restoredAt: _restoredAt,
    restoredBy: _restoredBy,
    deletedWithCascade: _deletedWithCascade,
    createdBy: _createdBy,
    updatedBy: _updatedBy,
    workspaceSubdomain: _workspaceSubdomain,
    discountPct: _discountPct,
    ...restRow
  } = nullsToUndefined(row);

  const custom =
    row.customFields && typeof row.customFields === "object" && !Array.isArray(row.customFields)
      ? (row.customFields as Record<string, unknown>)
      : {};

  return {
    ...custom,
    ...restRow,
    customFields: custom,
    contactId: restRow.contactId ?? "",
    fatherContactId: row.fatherContactId ?? null,
    motherContactId: row.motherContactId ?? null,
    guardianContactId: row.guardianContactId ?? null,
    status: (restRow.status as StudentStatus) ?? "active",
    enrolledSessions,
    discountPct: parseNumericColumn(row.discountPct),
    ...mapAuditTimestamps(row),
  } satisfies Student;
}
