import { randomUUID } from "node:crypto";
import type { AttendanceRecord } from "@mms/shared";
import type { attendance } from "../schema.js";

import { mapAuditTimestamps, mapAuditToInsert } from "./repositoryMappers.js";

export type AttendanceRow = typeof attendance.$inferSelect;
export type AttendanceInsert = typeof attendance.$inferInsert;

/** Row shape returned by explicit select projections (purgeAfter is DB-only generated column). */
export type AttendanceSelectRow = Omit<AttendanceRow, "purgeAfter" | "dateOn">;

/**
 * Canonical DB -> Contract mapper for Attendance.
 * Enforces compile-time completeness against AttendanceRecord.
 */
export function attendanceRowToRecord(row: AttendanceSelectRow | AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    classId: row.classId,
    studentId: row.studentId,
    studentName: row.studentName,
    rollNo: row.rollNo,
    date: row.date,
    status: row.status as AttendanceRecord["status"],
    timeIn: row.timeIn,
    timeOut: row.timeOut,
    notes: row.notes,
    markedBy: row.markedBy ?? null,
    sectionId: row.sectionId ?? null,
    ...mapAuditTimestamps(row),
  } satisfies AttendanceRecord;
}

/**
 * Canonical Contract -> DB insert payload builder.
 * Enforces Drizzle schema constraints and eliminates loose type casting.
 */
export function attendanceRecordToInsert(
  tenant: string,
  record: AttendanceRecord,
  idGenerator: () => string = () => `att-${randomUUID()}`,
): AttendanceInsert {
  const rawId = (record as unknown as { id?: unknown }).id;
  const resolvedId =
    typeof rawId === "string" && rawId.trim() !== ""
      ? rawId.trim()
      : typeof rawId === "number" && Number.isFinite(rawId)
        ? String(rawId)
        : idGenerator();

  const audit = mapAuditToInsert(record);

  return {
    id: resolvedId,
    workspaceSubdomain: tenant.trim().toLowerCase(),
    classId: String(record.classId || ""),
    studentId: String(record.studentId || ""),
    studentName: String(record.studentName || ""),
    rollNo: String(record.rollNo || ""),
    date: String(record.date || ""),
    status: String(record.status || "present"),
    timeIn: String(record.timeIn || ""),
    timeOut: String(record.timeOut || ""),
    notes: String(record.notes || ""),
    markedBy: record.markedBy ?? null,
    sectionId: record.sectionId ?? null,
    deletedAt: audit.deletedAt,
    deletedBy: audit.deletedBy,
    deletionReason: audit.deletionReason,
    updatedAt: audit.updatedAt,
    ...(audit.createdAt ? { createdAt: audit.createdAt } : {}),
  };
}
