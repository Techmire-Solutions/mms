import { sql } from "drizzle-orm";
import type { SessionActivityItem } from "@mms/shared";
import { withTenantRead } from "../tenant-context.js";

const ACTIVITY_LIMIT = 200;

/**
 * Read-only activity of a session, newest first: typed enrollment events (transfer, withdrawal,
 * re-admission, suspension, cancellation), section staff changes, section closures and session
 * calendar events. `title` is the subject (student, teacher, section or event name); the client
 * labels `kind`.
 */
export async function listSessionActivity(
  tenant: string,
  sessionId: string,
): Promise<SessionActivityItem[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute<SessionActivityItem>(sql`
      SELECT "on", kind, title, detail, actor FROM (
        SELECT to_char(COALESCE(t.effective_on, t.occurred_at::date), 'YYYY-MM-DD') AS "on",
               t.event_type AS kind, e.student_name AS title, t.reason AS detail, t.by AS actor,
               t.occurred_at AS sort_at
          FROM enrollment_timeline_events t
          JOIN enrollments e ON e.workspace_subdomain = t.workspace_subdomain AND e.id = t.enrollment_id
         WHERE t.workspace_subdomain = ${subdomain} AND e.session_id = ${sessionId}
           AND t.event_type IS NOT NULL
        UNION ALL
        SELECT to_char(a.start_on, 'YYYY-MM-DD'), 'staff_assigned',
               concat(COALESCE(NULLIF(concat_ws(' ', c.first_name, c.last_name), ''), a.faculty_id), ' · ', s.name),
               a.change_reason, NULL, a.created_at
          FROM section_staff_assignments a
          JOIN session_class_sections s ON s.workspace_subdomain = a.workspace_subdomain AND s.id = a.section_id
          LEFT JOIN faculty f ON f.workspace_subdomain = a.workspace_subdomain AND f.id = a.faculty_id
          LEFT JOIN faculty_employments fe ON fe.workspace_subdomain = f.workspace_subdomain AND fe.id = f.employment_id
          LEFT JOIN contacts c ON c.workspace_subdomain = fe.workspace_subdomain AND c.id = fe.contact_id
         WHERE a.workspace_subdomain = ${subdomain} AND s.session_id = ${sessionId} AND a.deleted_at IS NULL
        UNION ALL
        SELECT to_char(a.end_on, 'YYYY-MM-DD'), 'staff_ended',
               concat(COALESCE(NULLIF(concat_ws(' ', c.first_name, c.last_name), ''), a.faculty_id), ' · ', s.name),
               a.change_reason, NULL, a.updated_at
          FROM section_staff_assignments a
          JOIN session_class_sections s ON s.workspace_subdomain = a.workspace_subdomain AND s.id = a.section_id
          LEFT JOIN faculty f ON f.workspace_subdomain = a.workspace_subdomain AND f.id = a.faculty_id
          LEFT JOIN faculty_employments fe ON fe.workspace_subdomain = f.workspace_subdomain AND fe.id = f.employment_id
          LEFT JOIN contacts c ON c.workspace_subdomain = fe.workspace_subdomain AND c.id = fe.contact_id
         WHERE a.workspace_subdomain = ${subdomain} AND s.session_id = ${sessionId}
           AND a.deleted_at IS NULL AND a.end_on IS NOT NULL
        UNION ALL
        SELECT to_char(s.closed_on, 'YYYY-MM-DD'), 'section_closed', s.name, s.closed_reason, NULL, s.updated_at
          FROM session_class_sections s
         WHERE s.workspace_subdomain = ${subdomain} AND s.session_id = ${sessionId}
           AND s.closed_on IS NOT NULL
        UNION ALL
        SELECT to_char(ce.start_on, 'YYYY-MM-DD'), concat('calendar_', ce.kind), ce.title, ce.notes, NULL, ce.created_at
          FROM academic_calendar_events ce
         WHERE ce.workspace_subdomain = ${subdomain} AND ce.session_id = ${sessionId}
           AND ce.deleted_at IS NULL
      ) activity
      ORDER BY "on" DESC, sort_at DESC
      LIMIT ${ACTIVITY_LIMIT}`);
    return result.rows;
  });
}
