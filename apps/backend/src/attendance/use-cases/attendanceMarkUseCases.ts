import {
  attendanceListSchema,
  attendanceRecordChanged,
  type AttendanceRecord,
  type AttendanceRecordInsert,
  type AttendanceRecordUpdate,
  type User,
} from "@mms/shared";
import { withTenant } from "../../db/tenant-context.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { assertTeacherSectionScope } from "../../sessions/use-cases/teacherSectionScope.js";
import { HttpDomainError } from "../../lib/httpErrors.js";
import { stampAttendanceSections } from "./attendanceSectionStamp.js";
import { assertInstructionalDays } from "./instructionalDayGuard.js";
import { assertAttendanceWriteAllowed, attendancePolicyKey } from "./attendancePolicyGuard.js";
import { auditAttendanceMutation } from "./attendanceAudit.js";
import {
  notEnrolled,
  requireTenant,
  type AttendanceMutationDeps,
} from "./attendanceUseCaseSupport.js";

/** Fields an update may change; `id`, audit and soft-delete columns are server-owned. */
const MUTABLE_FIELDS = [
  "classId",
  "studentId",
  "studentName",
  "rollNo",
  "date",
  "status",
  "timeIn",
  "timeOut",
  "notes",
  "markedBy",
] as const;

/** Applies only the defined, client-mutable fields of a patch. */
function mergeAttendancePatch(
  existing: AttendanceRecord,
  patch: AttendanceRecordUpdate | Partial<AttendanceRecord>,
): AttendanceRecord {
  const merged: AttendanceRecord = { ...existing, id: existing.id };
  const record = patch as Partial<AttendanceRecord>;
  for (const field of MUTABLE_FIELDS) {
    const value = record[field];
    if (value !== undefined) {
      (merged as unknown as Record<string, unknown>)[field] = value;
    }
  }
  return merged;
}

/**
 * Marking use-cases: create, correct (including moving a mark to another day/class) and bulk upsert.
 *
 * Each opens its own transaction and runs, inside it: enrolment validation → section stamping →
 * teacher row-scope → instructional-day guard → write policy → persistence → audit. A policy
 * rejection therefore rolls back the guards' own side effects (the holiday-override audit row).
 */
export function createAttendanceMarkUseCases({
  repo,
  crud,
  policyStore,
  validateActiveForeignKeys,
  validateBatchActiveForeignKeys,
}: AttendanceMutationDeps) {
  return {
    createAttendanceRecord: async (
      record: AttendanceRecordInsert | AttendanceRecord,
      actor: User,
      overrideReason?: string | null,
    ): Promise<AttendanceRecord> => {
      const tenant = requireTenant();
      return withTenant(
        tenant,
        async (tx) => {
          await validateActiveForeignKeys(tenant, record);
          const stamped = await stampAttendanceSections(tenant, [record]);
          if (stamped.rejected.length > 0) throw notEnrolled(stamped.rejected[0]!);
          const prepared = stamped.records[0] as AttendanceRecord;

          // Section-level: a teacher staffed on Section A may not mark Section B of the same class.
          await assertTeacherSectionScope(actor, tenant, [
            {
              classId: prepared.classId,
              sectionId: prepared.sectionId ?? null,
              onDate: prepared.date,
            },
          ]);
          await assertInstructionalDays(
            tenant,
            [
              {
                classId: prepared.classId,
                studentId: prepared.studentId,
                date: prepared.date,
                id: prepared.id,
              },
            ],
            String(actor.id),
            tx,
          );
          const override = await assertAttendanceWriteAllowed({
            tenant,
            actor,
            rows: [prepared],
            overrideReason,
            store: policyStore,
          });

          const created = await crud.create(prepared);
          await auditAttendanceMutation(tx, {
            tenant,
            actor,
            action: "CREATE",
            record: created,
            ...(override.overridden
              ? { reason: overrideReason ?? null, tag: "attendance.override" }
              : {}),
          });
          return created;
        },
        { readOnly: false },
      );
    },

    updateAttendanceRecordById: async (
      id: string,
      patch: AttendanceRecordUpdate | Partial<AttendanceRecord>,
      actor: User,
      expectedVersion?: number,
      overrideReason?: string | null,
    ): Promise<AttendanceRecord | null> => {
      const tenant = requireTenant();
      if (expectedVersion !== undefined && !Number.isInteger(expectedVersion)) {
        throw new HttpDomainError(400, "validation_error", "Invalid x-expected-version header");
      }
      return withTenant(
        tenant,
        async (tx) => {
          const existing = await repo.findAttendanceRecordById(tenant, id);
          if (!existing || existing.deletedAt) return null;

          const merged = mergeAttendancePatch(existing, patch);
          const movedDay = merged.classId !== existing.classId || merged.date !== existing.date;

          await assertTeacherSectionScope(actor, tenant, [
            { classId: merged.classId, sectionId: merged.sectionId ?? null, onDate: merged.date },
          ]);
          if (movedDay) {
            await assertInstructionalDays(
              tenant,
              [
                {
                  classId: merged.classId,
                  studentId: merged.studentId,
                  date: merged.date,
                  id: merged.id,
                },
              ],
              String(actor.id),
              tx,
            );
          }
          await validateActiveForeignKeys(tenant, merged);

          const stamped = await stampAttendanceSections(tenant, [merged]);
          if (stamped.rejected.length > 0) throw notEnrolled(stamped.rejected[0]!);
          const prepared = stamped.records[0] as AttendanceRecord;

          const override = await assertAttendanceWriteAllowed({
            tenant,
            actor,
            rows: [prepared],
            existing: new Map([[attendancePolicyKey(existing), existing]]),
            overrideReason,
            store: policyStore,
          });

          const persisted = await repo.saveAttendanceRecordById(tenant, {
            ...prepared,
            version: expectedVersion ?? prepared.version,
          });
          if (!persisted) return null;

          await auditAttendanceMutation(tx, {
            tenant,
            actor,
            action: "UPDATE",
            record: persisted,
            before: existing,
            ...(override.overridden
              ? { reason: overrideReason ?? null, tag: "attendance.override" }
              : movedDay
                ? { tag: "attendance.moved" }
                : {}),
          });
          await broadcastCollection("attendance_records");
          return persisted;
        },
        { readOnly: false },
      );
    },

    /** Upserts only the supplied attendance records without removing unrelated rows. */
    upsertAttendanceRecords: async (
      records: (AttendanceRecordInsert | AttendanceRecord)[],
      actor: User,
      overrideReason?: string | null,
    ): Promise<AttendanceRecord[]> => {
      const tenant = requireTenant();
      const validated = attendanceListSchema.parse(records);
      return withTenant(
        tenant,
        async (tx) => {
          await validateBatchActiveForeignKeys(tenant, validated);
          const stamped = await stampAttendanceSections(tenant, validated);
          if (stamped.rejected.length > 0) throw notEnrolled(stamped.rejected[0]!);
          const rows = stamped.records;

          await assertTeacherSectionScope(
            actor,
            tenant,
            rows.map((row) => ({
              classId: row.classId,
              sectionId: row.sectionId ?? null,
              onDate: row.date,
            })),
          );
          await assertInstructionalDays(
            tenant,
            rows.map((row) => ({
              classId: row.classId,
              studentId: row.studentId,
              date: row.date,
              id: row.id,
            })),
            String(actor.id),
            tx,
          );

          const existing = await repo.findAttendanceRecordsForStudentsOnDates(
            tenant,
            rows.map((row) => row.studentId),
            rows.map((row) => row.date),
          );
          const existingByKey = new Map(
            existing.map((record) => [attendancePolicyKey(record), record]),
          );
          const override = await assertAttendanceWriteAllowed({
            tenant,
            actor,
            rows,
            existing: existingByKey,
            overrideReason,
            store: policyStore,
          });

          const persisted = await repo.bulkSaveAttendanceRecords(tenant, rows);

          // One audit row per mark that actually changed (soft-delete norm: per record), so a
          // 500-row roster does not write 500 rows that say nothing. The comparison covers every
          // client-mutable field — the old status-only check silently dropped time/note corrections.
          for (const record of persisted) {
            const before = existingByKey.get(attendancePolicyKey(record)) ?? null;
            if (before && !attendanceRecordChanged(before, record)) continue;
            await auditAttendanceMutation(tx, {
              tenant,
              actor,
              action: before ? "UPDATE" : "CREATE",
              record,
              before,
              ...(override.overridden
                ? { reason: overrideReason ?? null, tag: "attendance.override" }
                : {}),
            });
          }

          await broadcastCollection("attendance_records");
          return persisted;
        },
        { readOnly: false },
      );
    },
  };
}
