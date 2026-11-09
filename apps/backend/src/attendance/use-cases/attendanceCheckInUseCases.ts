import {
  ATTENDANCE_CHECKIN_LATE_WINDOW_DAYS,
  parseCheckInTime,
  type AttendanceCheckInBody,
  type AttendanceCheckInRow,
  type AttendanceRecord,
  type User,
} from "@mms/shared";
import { withTenant } from "../../db/tenant-context.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { stampAttendanceSections } from "./attendanceSectionStamp.js";
import { attendanceCalendarRepository } from "../repository/attendanceCalendarRepositoryAdapter.js";
import { assertTeacherSectionScope } from "../../sessions/use-cases/teacherSectionScope.js";
import { assertAttendanceWriteAllowed, attendancePolicyKey } from "./attendancePolicyGuard.js";
import { auditAttendanceMutation } from "./attendanceAudit.js";
import type { AttendanceMutationDeps } from "./attendanceUseCaseSupport.js";

/**
 * Device check-in ingestion (RFID / biometric / turnstile batches).
 *
 * The rules that make a device batch safe:
 * 1. **Validate everything before writing** — one bad row reports itself without half-writing the
 *    batch, and the accepted rows still commit atomically.
 * 2. **Duplicates are evidence, not errors**: a replayed batch (device retry) matches the existing
 *    mark and is reported `duplicate`, never written twice and never re-audited.
 * 3. **Timestamps are normalised and bounded** — `HH:mm`, ISO with offset or epoch, converted to the
 *    workspace timezone, inside a 7-day late-upload window, never in the future.
 * 4. **A human decision is never overwritten by a device** — `excused` is a recorded decision and a
 *    check-in cannot turn it into `present`. `absent` → `present` is allowed (the reader is evidence)
 *    and audited as a correction.
 * 5. **The roster lock still applies** — a submitted day needs an admin reopen.
 */

export interface CheckInRejection {
  row: number;
  code: string;
  message: string;
}

export interface CheckInIngestResult {
  accepted: number;
  duplicates: number;
  rejected: CheckInRejection[];
  records: AttendanceRecord[];
}

interface Candidate {
  index: number;
  row: AttendanceCheckInRow;
  record: AttendanceRecord;
}

export function createAttendanceCheckInUseCases({
  repo,
  policyStore,
}: Pick<AttendanceMutationDeps, "repo" | "policyStore">) {
  return {
    ingestCheckIns: async (
      tenant: string,
      body: AttendanceCheckInBody,
      actor: User,
      options: { now?: Date } = {},
    ): Promise<CheckInIngestResult> => {
      const subdomain = tenant.trim().toLowerCase();
      // Wall clock override for tests; the route never passes it.
      const receivedAt = options.now ?? new Date();
      return withTenant(
        subdomain,
        async (tx) => {
          const timeZone =
            (await attendanceCalendarRepository.findWorkspaceTimezone(subdomain)) ?? "UTC";
          const today = todayInTimeZone(timeZone, receivedAt);

          const rejected: CheckInRejection[] = [];
          const candidates: Candidate[] = [];

          for (const [index, row] of body.rows.entries()) {
            const parsed = parseCheckInTime(row.timeIn, row.date, {
              timeZone,
              today,
              maxAgeDays: ATTENDANCE_CHECKIN_LATE_WINDOW_DAYS,
            });
            if (!parsed.ok) {
              rejected.push({ row: index, code: parsed.code, message: parsed.message });
              continue;
            }
            candidates.push({
              index,
              row,
              record: {
                // Deterministic id: the natural-key upsert reuses the existing row when there is one.
                id: `att-${row.classId}-${row.studentId}-${parsed.value.date}`,
                classId: row.classId,
                studentId: row.studentId,
                studentName: "",
                rollNo: "",
                date: parsed.value.date,
                status: "present",
                timeIn: parsed.value.time,
                timeOut: "",
                notes: "",
                markedBy: String(actor.id),
              } as AttendanceRecord,
            });
          }

          if (candidates.length === 0) {
            return { accepted: 0, duplicates: 0, rejected, records: [] };
          }

          // Enrolment + section stamping: a device row for a non-enrolled student is a row error.
          const stamped = await stampAttendanceSections(
            subdomain,
            candidates.map((candidate) => candidate.record),
          );
          const rejectedKeys = new Set(
            stamped.rejected.map((row) => `${row.classId}|${row.studentId}|${row.date}`),
          );
          const enrolled = candidates.filter((candidate) => {
            const key = `${candidate.record.classId}|${candidate.record.studentId}|${candidate.record.date}`;
            if (!rejectedKeys.has(key)) return true;
            rejected.push({
              row: candidate.index,
              code: "attendance_not_enrolled",
              message: `Student ${candidate.record.studentId} has no enrollment in this class on ${candidate.record.date}`,
            });
            return false;
          });

          if (enrolled.length === 0) {
            return { accepted: 0, duplicates: 0, rejected, records: [] };
          }
          const stampByKey = new Map(
            stamped.records.map((record) => [attendancePolicyKey(record), record]),
          );
          const prepared = enrolled.map((candidate) => ({
            ...candidate,
            record: stampByKey.get(attendancePolicyKey(candidate.record)) ?? candidate.record,
          }));

          await assertTeacherSectionScope(
            actor,
            subdomain,
            prepared.map((candidate) => ({
              classId: candidate.record.classId,
              sectionId: candidate.record.sectionId ?? null,
              onDate: candidate.record.date,
            })),
          );

          const existingRows = await repo.findAttendanceRecordsForStudentsOnDates(
            subdomain,
            prepared.map((candidate) => candidate.record.studentId),
            prepared.map((candidate) => candidate.record.date),
          );
          const existingByKey = new Map(
            existingRows.map((record) => [attendancePolicyKey(record), record]),
          );

          // Duplicate / conflict classification against the existing marks.
          const toWrite: Array<Candidate & { before: AttendanceRecord | null }> = [];
          let duplicates = 0;
          for (const candidate of prepared) {
            const before = existingByKey.get(attendancePolicyKey(candidate.record)) ?? null;
            if (!before) {
              toWrite.push({ ...candidate, before: null });
              continue;
            }
            const beforeStatus = String(before.status).trim().toLowerCase();
            if (beforeStatus === "excused") {
              rejected.push({
                row: candidate.index,
                code: "attendance_excused_conflict",
                message: `${candidate.record.date}: the student has an approved excuse — a check-in cannot overwrite it`,
              });
              continue;
            }
            if (
              beforeStatus === String(candidate.record.status) &&
              String(before.timeIn ?? "") === String(candidate.record.timeIn ?? "")
            ) {
              duplicates += 1;
              continue;
            }
            toWrite.push({ ...candidate, before });
          }

          if (toWrite.length === 0) {
            return { accepted: 0, duplicates, rejected, records: [] };
          }

          const rows = toWrite.map((candidate) => candidate.record);
          await assertAttendanceWriteAllowed({
            tenant: subdomain,
            actor,
            rows,
            existing: new Map(
              toWrite
                .filter((candidate) => candidate.before)
                .map((candidate) => [attendancePolicyKey(candidate.record), candidate.before!]),
            ),
            source: "device",
            store: policyStore,
          });

          const persisted = await repo.bulkSaveAttendanceRecords(subdomain, rows);
          const persistedByKey = new Map(
            persisted.map((record) => [attendancePolicyKey(record), record]),
          );
          for (const candidate of toWrite) {
            const record = persistedByKey.get(attendancePolicyKey(candidate.record));
            if (!record) continue;
            const lateUpload = record.date < today;
            await auditAttendanceMutation(tx, {
              tenant: subdomain,
              actor,
              action: candidate.before ? "UPDATE" : "CREATE",
              record,
              before: candidate.before,
              tag: "attendance.device.check_in",
              // Device provenance lives in the audit payload (no extra columns on the mark).
              extra: {
                source: "device",
                deviceId: body.deviceId ?? null,
                externalId: candidate.row.externalId ?? null,
                receivedAt: receivedAt.toISOString(),
                lateUpload,
                previousStatus: candidate.before?.status ?? null,
              },
            });
          }

          return {
            accepted: persisted.length,
            duplicates,
            rejected,
            records: persisted,
          };
        },
        { readOnly: false },
      );
    },
  };
}
