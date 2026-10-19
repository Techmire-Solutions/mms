import { sql, type SQL } from "drizzle-orm";
import { normalizeAttendanceModulePreferences, weekdayIndexes } from "@mms/shared";
import { getAttendanceModulePreferences } from "./attendanceModulePreferencesRepository.js";

/** Builds the "counts toward attendance rates" predicate for an attendance table alias. */
export type CountableAttendanceSql = (alias: string) => SQL;

/**
 * Attendance-rate KPI definition (single source of truth for metrics and reports):
 * a row counts only when its date is an instructional day for its class — weekly working days
 * (session override, else workspace preference) adjusted by holidays / make-up days, narrowest
 * scope first — and the student was not on approved leave that day.
 * Mirrors `@mms/shared` `instructionalDayDecision`. Workspace-level EXISTS probes are
 * uncorrelated (evaluated once), so tenants without calendar data pay only the weekday check.
 */
export function countableAttendanceSql(
  subdomain: string,
  workspaceWeekdays: readonly number[],
): CountableAttendanceSql {
  const weekdays = `{${workspaceWeekdays.join(",")}}`;
  return (alias) => {
    const a = (column: string) => sql.raw(`${alias}.${column}`);
    const day = a("date_on");
    const sessionOfClass = sql`COALESCE((SELECT sc.session_id FROM session_classes sc
      WHERE sc.workspace_subdomain = ${a("workspace_subdomain")} AND sc.id = ${a("class_id")} LIMIT 1), ${a("class_id")})`;
    const calendarDecision = sql`CASE WHEN EXISTS (SELECT 1 FROM academic_calendar_events ce0
        WHERE ce0.workspace_subdomain = ${subdomain} AND ce0.deleted_at IS NULL AND ce0.kind IN ('holiday', 'makeup_day'))
      THEN (SELECT ce.kind = 'makeup_day' FROM academic_calendar_events ce
        WHERE ce.workspace_subdomain = ${a("workspace_subdomain")} AND ce.deleted_at IS NULL
          AND ce.kind IN ('holiday', 'makeup_day') AND ${day} BETWEEN ce.start_on AND ce.end_on
          AND (ce.scope = 'workspace'
            OR (ce.scope = 'session' AND ce.session_id = ${sessionOfClass})
            OR (ce.scope = 'class' AND ce.class_id = ${a("class_id")})
            OR (ce.scope = 'section' AND ce.section_id IN (SELECT en.section_id FROM enrollments en
              WHERE en.workspace_subdomain = ${a("workspace_subdomain")} AND en.student_id = ${a("student_id")}
                AND en.class_id = ${a("class_id")} AND en.deleted_at IS NULL)))
        ORDER BY CASE ce.scope WHEN 'section' THEN 0 WHEN 'class' THEN 1 WHEN 'session' THEN 2 ELSE 3 END, (ce.kind = 'holiday') DESC
        LIMIT 1)
      END`;
    const sessionWeekdays = sql`CASE WHEN EXISTS (SELECT 1 FROM session_working_days wd0 WHERE wd0.workspace_subdomain = ${subdomain})
      THEN (SELECT array_agg(wd.weekday::int) FROM session_working_days wd
        WHERE wd.workspace_subdomain = ${a("workspace_subdomain")} AND wd.session_id = ${sessionOfClass})
      END`;
    const onApprovedLeave = sql`(EXISTS (SELECT 1 FROM attendance_leaves lv0 WHERE lv0.workspace_subdomain = ${subdomain} AND lower(lv0.status) = 'approved')
      AND EXISTS (SELECT 1 FROM attendance_leaves lv
        WHERE lv.workspace_subdomain = ${a("workspace_subdomain")} AND lv.student_id = ${a("student_id")}
          AND lower(lv.status) = 'approved' AND ${day} BETWEEN lv.from_date AND lv.to_date))`;
    return sql`(COALESCE(${calendarDecision}, extract(dow FROM ${day})::int = ANY(COALESCE(${sessionWeekdays}, ${weekdays}::int[])))
      AND NOT ${onApprovedLeave})`;
  };
}

/** Loads the workspace working days and returns the countable predicate builder. */
export async function loadCountableAttendanceSql(
  subdomain: string,
): Promise<CountableAttendanceSql> {
  const prefs = normalizeAttendanceModulePreferences(
    await getAttendanceModulePreferences(subdomain),
  );
  return countableAttendanceSql(subdomain, weekdayIndexes(prefs.workingDays));
}
