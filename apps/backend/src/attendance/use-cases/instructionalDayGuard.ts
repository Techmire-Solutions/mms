import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  instructionalDayDecision,
  NON_INSTRUCTIONAL_DAY_ERROR_TYPE,
  normalizeAttendanceModulePreferences,
  weekdayIndexes,
  type CalendarEventLite,
} from '@mms/shared';
import { enrollments, sessionClasses } from '../../db/schema.js';
import { withTenantRead } from '../../db/tenant-context.js';
import { listCalendarEventsTx } from '../../db/repositories/academicCalendarRepository.js';
import { loadSessionWorkingDaysTx } from '../../db/repositories/sessionWorkingDays.js';
import { getAttendanceModulePreferences } from '../../db/repositories/attendanceModulePreferencesRepository.js';
import { HttpDomainError } from '../../lib/httpErrors.js';
import { recordModernAuditEvent } from '../../services/auditTrailService.js';

export interface AttendanceDayRow {
  classId: string;
  studentId: string;
  date: string;
}

export interface NonInstructionalRow extends AttendanceDayRow {
  eventTitle?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Rows whose date is not a teaching day for that student's class/section (holidays, weekly off-days). */
export async function findNonInstructionalRows(tenant: string, rows: readonly AttendanceDayRow[], workspaceDays: readonly string[]): Promise<NonInstructionalRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  const dated = rows.filter((row) => ISO_DATE.test(row.date) && row.classId);
  if (dated.length === 0) return [];
  const dates = dated.map((row) => row.date).sort();
  const classIds = [...new Set(dated.map((row) => row.classId))];
  const studentIds = [...new Set(dated.map((row) => row.studentId))];

  return withTenantRead(subdomain, async (tx) => {
    const classRows = await tx.select({ id: sessionClasses.id, sessionId: sessionClasses.sessionId }).from(sessionClasses)
      .where(and(eq(sessionClasses.workspaceSubdomain, subdomain), inArray(sessionClasses.id, classIds)));
    // Legacy rows may carry a session id in `class_id`.
    const sessionOf = new Map<string, string>(classIds.map((id) => [id, id]));
    for (const row of classRows) sessionOf.set(row.id, row.sessionId);
    const sessionDays = await loadSessionWorkingDaysTx(tx, subdomain, [...new Set(sessionOf.values())]);
    const placements = await tx.select({ studentId: enrollments.studentId, classId: enrollments.classId, sectionId: enrollments.sectionId })
      .from(enrollments)
      .where(and(eq(enrollments.workspaceSubdomain, subdomain), inArray(enrollments.classId, classIds),
        inArray(enrollments.studentId, studentIds), isNull(enrollments.deletedAt)));
    const sectionOf = new Map(placements.map((row) => [`${row.studentId}:${row.classId}`, row.sectionId]));
    const events: CalendarEventLite[] = await listCalendarEventsTx(tx, subdomain, { from: dates[0], to: dates[dates.length - 1] });
    const defaultWeekdays = weekdayIndexes(workspaceDays);

    return dated.flatMap((row) => {
      const sessionId = sessionOf.get(row.classId) ?? null;
      const override = sessionId ? sessionDays.get(sessionId) : undefined;
      const decision = instructionalDayDecision(row.date, {
        workingWeekdays: override?.length ? weekdayIndexes(override) : defaultWeekdays,
        events,
        scope: { sessionId, classId: row.classId, sectionId: sectionOf.get(`${row.studentId}:${row.classId}`) ?? null },
      });
      return decision.instructional ? [] : [{ ...row, eventTitle: decision.event?.title }];
    });
  });
}

/**
 * Blocks marking attendance on non-teaching days (409 `non_instructional_day`) unless the
 * Attendance policy allows extra classes, in which case each such day is audited.
 */
export async function assertInstructionalDays(tenant: string, rows: readonly AttendanceDayRow[], actorUserId: string): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const prefs = normalizeAttendanceModulePreferences(await getAttendanceModulePreferences(subdomain));
  const blocked = await findNonInstructionalRows(subdomain, rows, prefs.workingDays);
  if (blocked.length === 0) return;
  if (!prefs.allowExtraClassOnHolidays) {
    const first = blocked[0];
    throw new HttpDomainError(409, NON_INSTRUCTIONAL_DAY_ERROR_TYPE,
      `${first.date} is not a teaching day${first.eventTitle ? ` (${first.eventTitle})` : ''}`);
  }
  const days = [...new Set(blocked.map((row) => `${row.classId}:${row.date}`))];
  await recordModernAuditEvent({ workspaceSubdomain: subdomain, tableName: 'attendance', recordId: days[0],
    actionType: 'UPDATE', realUserId: actorUserId, newState: { extraClass: days, reason: 'Attendance marked on a non-instructional day' } });
}
