import {
  ATTENDANCE_MODULE_MANIFEST,
  isPastAttendanceCutoff,
  normalizeAttendanceModulePreferences,
  type AttendanceRecord,
  type User,
} from "@mms/shared";
import { canDeleteCollection } from "../../services/rbacService.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { attendanceCalendarRepository } from "../repository/attendanceCalendarRepositoryAdapter.js";
import {
  requireOverrideReason,
  toDomainError,
  type AttendanceOverrideSummary,
  type AttendancePolicyStore,
} from "./attendancePolicyTypes.js";

/**
 * Delete/restore gate: a stranded mark may only be archived when the day is not locked and the
 * marking cut-off has passed, and only delete-level staff may override either — with a reason.
 */

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;

const defaultPolicyStore: AttendancePolicyStore = attendanceCalendarRepository;

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
  overrideReason?: string | null;
  /** Device evidence is exempt from the cut-off (never from the roster lock). */
  source?: "manual" | "device";
  now?: Date;
  store?: AttendancePolicyStore;
}): Promise<AttendanceOverrideSummary> {
  if (input.records.length === 0) return { overridden: false, codes: [] };
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
  // The tenant switch *enables* overrides; the delete-level permission *authorises* them. Previously
  // the switch alone let any writer bypass the lock and the cut-off.
  const canOverride = preferences.allowManualOverride && canDeleteCollection(actor, COLLECTION);

  const lockedDays = await store.listLockedAttendanceDayKeys(
    tenant,
    input.records.map((record) => ({ classId: record.classId, date: record.date.slice(0, 10) })),
  );

  const blockingCodes: string[] = [];
  for (const record of input.records) {
    const day = record.date.slice(0, 10);
    if (lockedDays.has(`${record.classId}|${day}`) && preferences.lockAfterSubmit) {
      blockingCodes.push("attendance_day_locked");
    }
    if (
      input.source !== "device" &&
      isPastAttendanceCutoff(day, today, nowTime, preferences.cutoffTime)
    ) {
      blockingCodes.push("attendance_cutoff_passed");
    }
  }
  if (blockingCodes.length === 0) return { overridden: false, codes: [] };
  if (!canOverride) {
    const first = input.records[0]!;
    const day = first.date.slice(0, 10);
    const locked = blockingCodes.includes("attendance_day_locked");
    throw toDomainError({
      code: locked ? "attendance_day_locked" : "attendance_cutoff_passed",
      status: 409,
      message: locked
        ? `${day}: attendance for this class was submitted and is locked`
        : `${day}: the ${preferences.cutoffTime} marking cut-off has passed — an administrator must override`,
      date: day,
    });
  }
  const codes = [...new Set(blockingCodes)];
  requireOverrideReason(input.overrideReason, codes);
  return { overridden: true, codes };
}
