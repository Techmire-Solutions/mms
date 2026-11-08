import { attendance } from "../schema.js";
import type { AttendanceRecord } from "@mms/shared";
import { withTenant } from "../tenant-context.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import {
  attendanceRowToRecord as rowToRecord,
  attendanceRecordToInsert as recordToInsert,
} from "./attendanceRepositoryMappers.js";
import {
  ATTENDANCE_LIVE_ONLY,
  ATTENDANCE_NATURAL_KEY_TARGET,
  ATTENDANCE_UPSERT_SET,
  ATTENDANCE_VERSION_MATCH,
  attendanceNaturalKey,
  attendanceStaleWriteError,
  planAttendanceUpsert,
} from "./attendanceUpsert.js";
import { ATTENDANCE_RECORD_COLUMNS } from "./attendanceRowReads.js";

/** Re-exported so `attendanceRepository.js` stays the single import surface for the module. */
export {
  findAttendanceRecordById,
  findAttendanceRecordsByIds,
  findAttendanceRecordsForStudentsOnDates,
  listAttendanceRecordsByWorkspace,
  saveAttendanceRecordById,
} from "./attendanceRowReads.js";

export async function saveAttendanceRecord(
  tenant: string,
  record: AttendanceRecord,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const values = recordToInsert(subdomain, record);
    const expectedVersion = typeof record.version === "number" ? record.version : undefined;
    try {
      const rows = await tx
        .insert(attendance)
        .values(values)
        .onConflictDoUpdate({
          target: ATTENDANCE_NATURAL_KEY_TARGET,
          targetWhere: ATTENDANCE_LIVE_ONLY,
          set: ATTENDANCE_UPSERT_SET,
          // Per-row OCC: `excluded.version` carries the token the caller read. A row whose
          // token moved on is left untouched, so the write either applies or 409s.
          setWhere: expectedVersion !== undefined ? ATTENDANCE_VERSION_MATCH : ATTENDANCE_LIVE_ONLY,
        })
        .returning({ id: attendance.id });

      if (rows.length === 0) throw attendanceStaleWriteError(record);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          `Attendance for student ${record.studentId} on ${record.date} already exists`,
          "attendance_duplicate",
        );
      }
      throw error;
    }
  });
}

/**
 * Upserts a marked roster atomically.
 *
 * Two statements at most: one for rows that carry an OCC token, one for legacy rows without one.
 * Dedupe, locking order and OCC semantics live in {@link planAttendanceUpsert} so they are unit
 * tested without a database.
 */
export async function bulkSaveAttendanceRecords(
  tenant: string,
  records: AttendanceRecord[],
): Promise<AttendanceRecord[]> {
  if (records.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  const { withToken, withoutToken } = planAttendanceUpsert(records);

  return withTenant(subdomain, async (tx) => {
    const persisted: AttendanceRecord[] = [];

    /**
     * `ON CONFLICT DO UPDATE … WHERE` silently skips a row whose predicate fails (archived, or a
     * stale OCC token). Compare `RETURNING` against the input and refuse the batch: a save that
     * wrote nothing must not report success, and the transaction rollback keeps it all-or-nothing.
     */
    const assertEveryRowWritten = (
      rows: Array<{ classId: string; studentId: string; date: string }>,
      expected: AttendanceRecord[],
    ): void => {
      if (rows.length === expected.length) return;
      const returned = new Set(rows.map((row) => attendanceNaturalKey(row)));
      const lost = expected.find((record) => !returned.has(attendanceNaturalKey(record)));
      throw attendanceStaleWriteError(lost ?? {});
    };

    try {
      if (withoutToken.length > 0) {
        const rows = await tx
          .insert(attendance)
          .values(withoutToken.map((record) => recordToInsert(subdomain, record)))
          .onConflictDoUpdate({
            target: ATTENDANCE_NATURAL_KEY_TARGET,
            targetWhere: ATTENDANCE_LIVE_ONLY,
            set: ATTENDANCE_UPSERT_SET,
            setWhere: ATTENDANCE_LIVE_ONLY,
          })
          .returning(ATTENDANCE_RECORD_COLUMNS);

        assertEveryRowWritten(rows, withoutToken);
        persisted.push(...rows.map(rowToRecord));
      }

      if (withToken.length > 0) {
        const rows = await tx
          .insert(attendance)
          .values(withToken.map((record) => recordToInsert(subdomain, record)))
          .onConflictDoUpdate({
            target: ATTENDANCE_NATURAL_KEY_TARGET,
            targetWhere: ATTENDANCE_LIVE_ONLY,
            set: ATTENDANCE_UPSERT_SET,
            setWhere: ATTENDANCE_VERSION_MATCH,
          })
          .returning(ATTENDANCE_RECORD_COLUMNS);

        assertEveryRowWritten(rows, withToken);
        persisted.push(...rows.map(rowToRecord));
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          "Attendance already exists for this student and day — reload the roster and retry",
          "attendance_duplicate",
        );
      }
      throw error;
    }

    return persisted;
  });
}

/**
 * Trash lifecycle (soft delete, restore, restore-mirror replacement) lives in
 * `attendanceRepositoryTrash.ts`; re-exported here so adapters, the backup/restore mapping and the
 * service layer keep one import surface.
 */
export {
  bulkRestoreAttendanceRecords,
  bulkSoftDeleteAttendanceRecords,
  deleteAttendanceRecordsByWorkspace,
  replaceAttendanceRecordsForWorkspace,
} from "./attendanceRepositoryTrash.js";
