import {
  ATTENDANCE_MODULE_MANIFEST,
  evaluateAttendanceWrite,
  normalizeAttendanceModulePreferences,
  type AttendanceModulePreferences,
  type AttendancePolicyRow,
  type AttendanceRecord,
  type User,
} from "@mms/shared";
import { attendanceCalendarRepository } from "../repository/attendanceCalendarRepositoryAdapter.js";
import { canDeleteCollection } from "../../services/rbacService.js";
import { HttpDomainError } from "../../lib/httpErrors.js";
import { AttendanceBatchRejectedError } from "./attendanceBatchErrors.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { currentTimeInTimeZone } from "./attendanceDayEditGuard.js";
import {
  OVERRIDABLE_CODES,
  requireOverrideReason,
  type AttendanceOverrideSummary,
  type AttendancePolicyStore,
} from "./attendancePolicyTypes.js";

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

const defaultPolicyStore: AttendancePolicyStore = attendanceCalendarRepository;

export interface AttendancePolicyInput {
  tenant: string;
  actor: User;
  /** Rows as they would be persisted (already section-stamped). */
  rows: AttendanceRecord[];
  /** Existing live rows by {@link attendancePolicyKey}, when this write corrects them. */
  existing?: Map<string, AttendanceRecord | null>;
  /**
   * Justification for overriding a lock or the marking cut-off. Required exactly when the write
   * would otherwise be refused; stored in the audit row.
   */
  overrideReason?: string | null;
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

/**
 * Throws the first policy violation for the batch.
 *
 * A violation aborts the caller's transaction, so nothing is half-written. Rows are evaluated in
 * batch order, which keeps the reported error deterministic.
 */
export async function assertAttendanceWriteAllowed(
  input: AttendancePolicyInput,
): Promise<AttendanceOverrideSummary> {
  if (input.rows.length === 0) return { overridden: false, codes: [] };
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

  // Tenant switch enables, delete-level permission authorises (see `assertAttendanceDayEditable`).
  const canOverride = preferences.allowManualOverride && canDeleteCollection(actor, COLLECTION);

  /**
   * Evaluate every row before failing so a batch reports **all** of its invalid rows, not just the
   * first. A single bad row still throws the ordinary single-error shape; two or more throw the
   * batch envelope (the write itself remains all-or-nothing).
   */
  const failures: Array<{
    index: number;
    studentId: string;
    date: string;
    code: string;
    message: string;
    status: number;
  }> = [];
  const overrideCodes: string[] = [];

  for (const [index, row] of input.rows.entries()) {
    const key = attendancePolicyKey(row);
    const existingRecord = input.existing?.get(key) ?? null;
    // Always evaluate the **strict** rule set first: that is how we learn whether this row needs an
    // override at all. Evaluating with `canOverride` straight away would hide the very rule the
    // override would be bypassing, and the reason requirement would never trigger.
    const errors = evaluateAttendanceWrite(toPolicyRow(row), preferences, {
      today,
      nowTime,
      canOverride: false,
      existing: existingRecord ? toPolicyRow(existingRecord) : null,
      isApprovedLeave: () => onLeave.has(key),
      isDaySubmitted: () => lockedDays.has(`${row.classId}|${row.date.slice(0, 10)}`),
    });
    // Which refusals are override-able? Only the lock and the cut-off. Evaluating the row again
    // with the override enabled tells us whether an approved override actually clears it.
    const overridable = errors.filter((error) => OVERRIDABLE_CODES.has(error.code));
    if (overridable.length > 0 && canOverride) {
      overrideCodes.push(...overridable.map((error) => error.code));
      const withOverride = evaluateAttendanceWrite(toPolicyRow(row), preferences, {
        today,
        nowTime,
        canOverride: true,
        existing: existingRecord ? toPolicyRow(existingRecord) : null,
        isApprovedLeave: () => onLeave.has(key),
        isDaySubmitted: () => lockedDays.has(`${row.classId}|${row.date.slice(0, 10)}`),
      });
      const remaining = withOverride[0];
      if (!remaining) continue;
      failures.push({
        index,
        studentId: row.studentId,
        date: row.date.slice(0, 10),
        code: remaining.code,
        message: remaining.message,
        status: remaining.status,
      });
      continue;
    }
    const first = errors[0];
    if (!first) continue;
    failures.push({
      index,
      studentId: row.studentId,
      date: row.date.slice(0, 10),
      code: first.code,
      message: first.message,
      status: first.status,
    });
  }

  if (failures.length === 1) {
    const [only] = failures;
    throw new HttpDomainError(only!.status, only!.code, only!.message);
  }
  if (failures.length > 1) throw new AttendanceBatchRejectedError(failures);
  if (overrideCodes.length > 0) {
    const codes = [...new Set(overrideCodes)];
    requireOverrideReason(input.overrideReason, codes);
    return { overridden: true, codes };
  }
  return { overridden: false, codes: [] };
}

// The delete/restore gate and the clock helper live in their own module for the 300-line band; they
// are re-exported here because every caller imports them from the policy guard.
export { assertAttendanceDayEditable, currentTimeInTimeZone } from "./attendanceDayEditGuard.js";
export type { AttendanceOverrideSummary, AttendancePolicyStore } from "./attendancePolicyTypes.js";
