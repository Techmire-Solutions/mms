import {
  evaluateAttendanceWrite,
  isPastAttendanceCutoff,
  normalizeAttendanceModulePreferences,
  type AttendanceModulePreferences,
  type AttendancePolicyError,
  type AttendancePolicyRow,
  type AttendanceRecord,
  type User,
} from "@mms/shared";
import { attendanceCalendarRepository } from "../repository/attendanceCalendarRepositoryAdapter.js";
import type { AttendanceCalendarRepository } from "../repository/attendanceCalendarRepository.js";
import { canDeleteCollection } from "../../services/rbacService.js";
import { ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { HttpDomainError } from "../../lib/httpErrors.js";
import { todayInTimeZone } from "../../lib/dbDate.js";

/**
 * The single policy gate for every attendance write path
 * (create, correction, bulk roster save, and any future import job).
 *
 * It resolves the tenant's preferences, the approved leaves covering the batch and the roster-day
 * submission state **once per operation**, then evaluates each row with the pure
 * `evaluateAttendanceWrite`. Keeping it here — not in the route handler — is what makes the rules
 * apply to non-HTTP callers too.
 */

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;

/**
 * The slice of the calendar/leave/submission store the policy needs. Narrow on purpose: a test (or a
 * future non-DB caller) can provide these four lookups without a database.
 */
export type AttendancePolicyStore = Pick<
  AttendanceCalendarRepository,
  | "getAttendanceModulePreferences"
  | "findWorkspaceTimezone"
  | "listApprovedLeavesFor"
  | "listLockedAttendanceDayKeys"
  | "lockAttendanceStudents"
>;

const defaultPolicyStore: AttendancePolicyStore = attendanceCalendarRepository;

export interface AttendancePolicyInput {
  tenant: string;
  actor: User;
  /** Rows as they would be persisted (already section-stamped). */
  rows: AttendanceRecord[];
  /** Existing live rows by {@link attendancePolicyKey}, when this write corrects them. */
  existing?: Map<string, AttendanceRecord | null>;
  /** Wall clock override for tests. */
  now?: Date;
  /** Policy lookups; defaults to the Drizzle-backed calendar adapter. */
  store?: AttendancePolicyStore;
}

/** Row key shared with the section stamping and upsert planner. */
export function attendancePolicyKey(row: {
  classId?: string | null;
  studentId?: string | null;
  date?: string | null;
}): string {
  return `${String(row.classId ?? "").trim()}|${String(row.studentId ?? "").trim()}|${String(row.date ?? "").slice(0, 10)}`;
}

function toPolicyRow(row: AttendanceRecord): AttendancePolicyRow {
  return {
    classId: row.classId,
    studentId: row.studentId,
    date: row.date.slice(0, 10),
    status: row.status,
    timeIn: row.timeIn ?? "",
    timeOut: row.timeOut ?? "",
    notes: row.notes ?? "",
  };
}

function toDomainError(error: AttendancePolicyError): HttpDomainError {
  return new HttpDomainError(error.status, error.code, error.message);
}

/** Current wall-clock `HH:mm` in the workspace timezone. */
export function currentTimeInTimeZone(timeZone: string | null | undefined, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
  } catch {
    return now.toISOString().slice(11, 16);
  }
}

/**
 * Lighter gate for state-changing operations that carry no new status (delete / restore):
 * only the day lock and the cut-off apply.
 */
export async function assertAttendanceDayEditable(input: {
  tenant: string;
  actor: User;
  records: ReadonlyArray<Pick<AttendanceRecord, "classId" | "date" | "status">>;
  now?: Date;
  store?: AttendancePolicyStore;
}): Promise<void> {
  if (input.records.length === 0) return;
  const { tenant, actor } = input;
  const now = input.now ?? new Date();
  const store = input.store ?? defaultPolicyStore;

  const [rawPreferences, timeZone] = await Promise.all([
    store.getAttendanceModulePreferences(tenant),
    store.findWorkspaceTimezone(tenant),
  ]);
  const preferences = normalizeAttendanceModulePreferences(rawPreferences);
  const today = todayInTimeZone(timeZone, now);
  const nowTime = currentTimeInTimeZone(timeZone, now);
  const canOverride = preferences.allowManualOverride || canDeleteCollection(actor, COLLECTION);

  const lockedDays = await store.listLockedAttendanceDayKeys(
    tenant,
    input.records.map((record) => ({ classId: record.classId, date: record.date.slice(0, 10) })),
  );

  for (const record of input.records) {
    const day = record.date.slice(0, 10);
    if (lockedDays.has(`${record.classId}|${day}`) && preferences.lockAfterSubmit && !canOverride) {
      throw toDomainError({
        code: "attendance_day_locked",
        status: 409,
        message: `${day}: attendance for this class was submitted and is locked`,
        date: day,
      });
    }
    if (!canOverride && isPastAttendanceCutoff(day, today, nowTime, preferences.cutoffTime)) {
      throw toDomainError({
        code: "attendance_cutoff_passed",
        status: 409,
        message: `${day}: the ${preferences.cutoffTime} marking cut-off has passed — an administrator must override`,
        date: day,
      });
    }
  }
}

/**
 * Throws the first policy violation for the batch.
 *
 * A violation aborts the caller's transaction, so nothing is half-written. Rows are evaluated in
 * batch order, which keeps the reported error deterministic.
 */
export async function assertAttendanceWriteAllowed(input: AttendancePolicyInput): Promise<void> {
  if (input.rows.length === 0) return;
  const { tenant, actor } = input;
  const now = input.now ?? new Date();
  const store = input.store ?? defaultPolicyStore;

  const [rawPreferences, timeZone] = await Promise.all([
    store.getAttendanceModulePreferences(tenant),
    store.findWorkspaceTimezone(tenant),
  ]);
  const preferences: AttendanceModulePreferences =
    normalizeAttendanceModulePreferences(rawPreferences);

  const today = todayInTimeZone(timeZone, now);
  const nowTime = currentTimeInTimeZone(timeZone, now);

  const studentIds = [...new Set(input.rows.map((row) => row.studentId).filter(Boolean))];
  // Serialise against a concurrent leave decision before reading whether these students are on
  // leave: without the lock, an approval committing right after this read would leave a `present`
  // mark on an approved-leave day (F5). The decision path takes the same per-student lock.
  await store.lockAttendanceStudents(tenant, studentIds);
  const days = input.rows
    .map((row) => row.date.slice(0, 10))
    .filter(Boolean)
    .sort();
  const fromOn = days[0] ?? today;
  const toOn = days[days.length - 1] ?? today;

  const [leaves, lockedDays] = await Promise.all([
    store.listApprovedLeavesFor(tenant, studentIds, fromOn, toOn),
    store.listLockedAttendanceDayKeys(
      tenant,
      input.rows.map((row) => ({ classId: row.classId, date: row.date.slice(0, 10) })),
    ),
  ]);

  const onLeave = new Set<string>();
  for (const leave of leaves) {
    if (!leave.fromDate || !leave.toDate) continue;
    for (const row of input.rows) {
      const day = row.date.slice(0, 10);
      if (row.studentId === leave.studentId && leave.fromDate <= day && day <= leave.toDate) {
        onLeave.add(attendancePolicyKey(row));
      }
    }
  }

  const canOverride = preferences.allowManualOverride || canDeleteCollection(actor, COLLECTION);

  for (const row of input.rows) {
    const key = attendancePolicyKey(row);
    const existingRecord = input.existing?.get(key) ?? null;
    const errors = evaluateAttendanceWrite(toPolicyRow(row), preferences, {
      today,
      nowTime,
      canOverride,
      existing: existingRecord ? toPolicyRow(existingRecord) : null,
      isApprovedLeave: () => onLeave.has(key),
      isDaySubmitted: () => lockedDays.has(`${row.classId}|${row.date.slice(0, 10)}`),
    });
    const [first] = errors;
    if (first) throw toDomainError(first);
  }
}
