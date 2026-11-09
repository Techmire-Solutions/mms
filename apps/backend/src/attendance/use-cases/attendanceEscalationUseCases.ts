import {
  findAbsenceStreaks,
  normalizeAttendanceModulePreferences,
  shouldNotifyAbsenceAlert,
  type AbsenceStreakDay,
  type AttendanceModulePreferences,
  type AttendanceRecordStatus,
  type User,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { withTenant } from "../../db/tenant-context.js";
import { notificationsUseCases } from "../../notifications/use-cases/notificationsUseCases.js";
import { recordModernAuditEvent, type DbOrTransaction } from "../../services/auditTrailService.js";
import { NotFoundError } from "../../lib/httpErrors.js";
import {
  attendanceEscalationRepository as repo,
  type AbsenceAlertRow,
} from "../repository/attendanceEscalationAdapter.js";
import { attendanceCalendarRepository } from "../repository/attendanceCalendarRepositoryAdapter.js";

/**
 * Chronic-absence escalation.
 *
 * The scan rebuilds each student's marked-day sequence for the window, evaluates it with the shared
 * pure streak rule, and records one alert per streak. It is idempotent per streak: the alert row's
 * unique key absorbs re-runs, and the notification fires only the first time.
 */

/** How far back a streak is measured. Long enough to catch a term-start run without scanning a year. */
export const ABSENCE_STREAK_WINDOW_DAYS = 45;

/**
 * Per-scan notification ceiling.
 *
 * A mass-absence day (exam week, a storm, a data import) can flag hundreds of students in one run.
 * Beyond this many per-student notifications the scan stores **one summary** instead, so the
 * notification centre cannot be flooded; every alert row is still created (the queue is the source
 * of truth).
 */
export const ABSENCE_NOTIFY_MAX_PER_SCAN = 100;

function requireTenant(): string {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  return tenant;
}

function isoDaysAgo(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

export interface AbsenceScanResult {
  studentsScanned: number;
  streaksFound: number;
  alertsRaised: number;
  alertsUpdated: number;
  /** Per-student notifications stored (or already present) in this run. */
  notified: number;
  /** True when the per-scan ceiling was hit and a summary notification replaced the rest. */
  notificationsCapped: boolean;
}

/**
 * Recomputes streak alerts for the tenant.
 *
 * Runs outside a request: the scheduled job passes the tenant explicitly. Returns counts so the
 * worker log and the manual-scan route can report what happened.
 */
export async function scanAbsenceStreaks(
  tenant: string,
  options: { now?: Date } = {},
): Promise<AbsenceScanResult> {
  const subdomain = tenant.trim().toLowerCase();
  const now = options.now ?? new Date();
  const since = isoDaysAgo(ABSENCE_STREAK_WINDOW_DAYS, now);

  const preferences: AttendanceModulePreferences = normalizeAttendanceModulePreferences(
    await attendanceCalendarRepository.getAttendanceModulePreferences(subdomain),
  );
  const threshold = preferences.absenceStreakThreshold;

  const [classDays, marks] = await Promise.all([
    repo.listClassMarkedDays(subdomain, since),
    repo.listCountableMarks(subdomain, since),
  ]);

  // classId -> ordered marked days
  const daysByClass = new Map<string, string[]>();
  for (const row of classDays) {
    const list = daysByClass.get(row.classId) ?? [];
    list.push(row.date);
    daysByClass.set(row.classId, list);
  }
  for (const list of daysByClass.values()) list.sort();

  // `classId|studentId` -> date -> status
  const statusByStudentDay = new Map<string, Map<string, AttendanceRecordStatus>>();
  for (const row of marks) {
    const key = `${row.classId}|${row.studentId}`;
    const byDay = statusByStudentDay.get(key) ?? new Map<string, AttendanceRecordStatus>();
    byDay.set(row.date, row.status as AttendanceRecordStatus);
    statusByStudentDay.set(key, byDay);
  }

  let streaksFound = 0;
  let alertsRaised = 0;
  let alertsUpdated = 0;
  let notified = 0;
  let notificationsCapped = false;

  for (const [key, byDay] of statusByStudentDay) {
    const [classId, studentId] = key.split("|");
    const classDaysForClass = daysByClass.get(classId ?? "") ?? [];
    if (!classId || !studentId || classDaysForClass.length === 0) continue;

    // The sequence is the class's marked days; a day this student has no (countable) mark for is
    // "unmarked" and breaks the streak rather than extending it. Non-countable marks (holiday
    // overrides, approved leave) were filtered out by the query, so they also break it.
    const days: AbsenceStreakDay[] = classDaysForClass.map((date) => ({
      date,
      status: byDay.get(date) ?? null,
      countable: true,
    }));

    const streaks = findAbsenceStreaks(days, threshold);
    streaksFound += streaks.length;
    for (const streak of streaks) {
      const outcome = await withTenant(
        subdomain,
        (tx) =>
          recordAlert(tx, subdomain, {
            classId,
            studentId,
            streak,
            threshold,
            notifyBudgetRemaining: Math.max(0, ABSENCE_NOTIFY_MAX_PER_SCAN - notified),
          }),
        { readOnly: false },
      );
      if (outcome.created) alertsRaised += 1;
      else alertsUpdated += 1;
      if (outcome.notified) notified += 1;
      if (outcome.capped) notificationsCapped = true;
    }
  }

  if (notificationsCapped) {
    // One summary replaces the per-student notifications beyond the ceiling (dedupe-keyed per day so
    // repeated scans in the same day collapse).
    await notificationsUseCases.notify(subdomain, {
      kind: "attendance_chronic_absence",
      audiencePermission: "students.write",
      entityType: "attendance_absence_scan",
      entityId: `scan-${now.toISOString().slice(0, 10)}`,
      subjectLabel: `${notified} students flagged`,
      contextLabel: `Chronic-absence scan capped at ${ABSENCE_NOTIFY_MAX_PER_SCAN} per-student alerts`,
      dedupeKey: `absence-scan-summary:${subdomain}:${now.toISOString().slice(0, 10)}`,
    });
  }

  return {
    studentsScanned: statusByStudentDay.size,
    streaksFound,
    alertsRaised,
    alertsUpdated,
    notified,
    notificationsCapped,
  };
}

async function recordAlert(
  tx: DbOrTransaction,
  tenant: string,
  input: {
    classId: string;
    studentId: string;
    streak: { startDate: string; endDate: string; length: number };
    threshold: number;
    /** 0 means the per-scan ceiling is reached: stamp the alert without a per-student notification. */
    notifyBudgetRemaining: number;
  },
): Promise<{ created: boolean; notified: boolean; capped: boolean }> {
  const alert = await repo.upsertAbsenceAlert(tenant, {
    classId: input.classId,
    studentId: input.studentId,
    streakStart: input.streak.startDate,
    streakEnd: input.streak.endDate,
    streakLength: input.streak.length,
    threshold: input.threshold,
  });

  if (alert.created) {
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: tenant,
      tableName: "attendance_absence_alerts",
      recordId: alert.id,
      actionType: "CREATE",
      newState: {
        studentId: input.studentId,
        classId: input.classId,
        streakStart: input.streak.startDate,
        streakEnd: input.streak.endDate,
        streakLength: input.streak.length,
        threshold: input.threshold,
      },
      minimizeDelta: true,
    });
  }

  if (!alert.id || !shouldNotifyAbsenceAlert(alert.status) || alert.notifiedAt) {
    return { created: alert.created, notified: false, capped: false };
  }

  if (input.notifyBudgetRemaining <= 0) {
    // Ceiling reached: stamp the alert so it does not retry forever, but send no per-student row.
    // The summary notification is emitted once at the end of the scan.
    await repo.claimAbsenceAlertNotification(tenant, alert.id);
    return { created: alert.created, notified: false, capped: true };
  }

  // Claim first: the atomic UPDATE is what stops a concurrent scan (manual job + hourly sweep) from
  // sending the same notification twice. The dedupe key covers the crash window after the claim.
  const claimed = await repo.claimAbsenceAlertNotification(tenant, alert.id);
  if (!claimed) return { created: alert.created, notified: false, capped: false };

  const stored = await notificationsUseCases.notify(tenant, {
    kind: "attendance_chronic_absence",
    audiencePermission: "students.write",
    entityType: "attendance_absence_alert",
    entityId: alert.id,
    subjectLabel: input.studentId,
    contextLabel: `${input.streak.length} consecutive absences (${input.streak.startDate} → ${input.streak.endDate})`,
    dedupeKey: `absence-alert:${alert.id}`,
  });
  if (!stored) {
    // Release so the next sweep retries instead of leaving the alert silently un-notified.
    await repo.releaseAbsenceAlertNotification(tenant, alert.id);
    return { created: alert.created, notified: false, capped: false };
  }
  return { created: alert.created, notified: true, capped: false };
}

export function createAttendanceEscalationUseCases() {
  return {
    /** Manual scan (a route) — the scheduler calls {@link scanAbsenceStreaks} directly. */
    scan: async (): Promise<AbsenceScanResult> => scanAbsenceStreaks(requireTenant()),

    listAlerts: (options: {
      status?: string;
      studentId?: string;
      classId?: string;
    }): Promise<AbsenceAlertRow[]> => repo.listAbsenceAlerts(requireTenant(), options),

    resolveAlert: async (
      id: string,
      input: { status: "resolved" | "dismissed"; note?: string | null },
      actor: User,
    ): Promise<AbsenceAlertRow> => {
      const tenant = requireTenant();
      return withTenant(
        tenant,
        async (tx) => {
          const row = await repo.resolveAbsenceAlert(tenant, {
            id,
            status: input.status,
            resolvedBy: String(actor.id),
            note: input.note ?? null,
          });
          if (!row) throw new NotFoundError("Absence alert not found or already closed");
          await recordModernAuditEvent(tx, {
            workspaceSubdomain: tenant,
            tableName: "attendance_absence_alerts",
            recordId: row.id,
            actionType: "UPDATE",
            realUserId: actor.id ? String(actor.id) : null,
            oldState: { status: "open" },
            newState: { status: row.status, note: input.note ?? null },
            minimizeDelta: true,
          });
          return row;
        },
        { readOnly: false },
      );
    },
  };
}

export const attendanceEscalationUseCases = createAttendanceEscalationUseCases();
