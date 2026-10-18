import { sql } from 'drizzle-orm';
import type { SessionsReportAggregates } from '@mms/shared';
import { getQueryRows } from '../documentStoreKeys.js';
import { withTenantRead } from '../tenant-context.js';

const WEEKDAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * SQL aggregates for Sessions Reports: capacity-by-class, enrollment trends, today's class rows.
 */
export async function loadSessionsReportAggregatesSql(
  tenant: string,
): Promise<SessionsReportAggregates> {
  const subdomain = tenant.trim().toLowerCase();
  const todayKey = WEEKDAY_KEYS[new Date().getDay()] ?? 'Mon';

  return withTenantRead(subdomain, async (tx) => {
    const capacityResult = await tx.execute(sql`
      SELECT
        s.id AS "sessionId",
        c.id AS "classId",
        s.name AS session,
        c.name AS class,
        ce.enrolled AS enrolled,
        c.capacity AS capacity,
        CASE
          WHEN c.capacity > 0
            THEN ROUND((ce.enrolled::numeric / c.capacity::numeric) * 100)::int
          ELSE 0
        END AS rate,
        s.status AS status
      FROM sessions s
      INNER JOIN session_classes c
        ON c.workspace_subdomain = s.workspace_subdomain
        AND c.session_id = s.id
      CROSS JOIN LATERAL (SELECT count(*)::int AS enrolled FROM enrollments e WHERE e.workspace_subdomain = c.workspace_subdomain AND e.session_id = c.session_id AND e.class_id = c.id AND e.deleted_at IS NULL AND e.status <> 'cancelled') ce
      WHERE s.workspace_subdomain = ${subdomain}
        AND s.deleted_at IS NULL
      ORDER BY s.name ASC, c.name ASC
    `);

    const trendResult = await tx.execute(sql`
      WITH monthly AS (
        SELECT
          to_char(
            date_trunc(
              'month',
              (NULLIF(trim(e.enrolled_date), ''))::timestamp
            ),
            'YYYY-MM'
          ) AS "monthKey",
          NULLIF(trim(s.name), '') AS "sessionName",
          count(*)::int AS cnt
        FROM enrollments e
        LEFT JOIN sessions s
          ON s.workspace_subdomain = e.workspace_subdomain
          AND s.id = e.session_id
          AND s.deleted_at IS NULL
        WHERE e.workspace_subdomain = ${subdomain}
          AND e.deleted_at IS NULL
          AND NULLIF(trim(e.enrolled_date), '') IS NOT NULL
          AND NULLIF(trim(e.enrolled_date), '') ~ '^[0-9]{4}'
        GROUP BY 1, 2
      ),
      totals AS (
        SELECT "monthKey", sum(cnt)::int AS students
        FROM monthly
        WHERE "monthKey" IS NOT NULL
        GROUP BY 1
      ),
      tops AS (
        SELECT DISTINCT ON ("monthKey")
          "monthKey",
          "sessionName"
        FROM monthly
        WHERE "sessionName" IS NOT NULL
        ORDER BY "monthKey", cnt DESC
      )
      SELECT
        t."monthKey",
        t.students,
        tops."sessionName"
      FROM totals t
      LEFT JOIN tops ON tops."monthKey" = t."monthKey"
      ORDER BY t."monthKey" ASC
    `);

    const todayResult = await tx.execute(sql`
      SELECT
        (s.id || '-' || c.id) AS id,
        (s.name || ' – ' || c.name) AS name,
        COALESCE(NULLIF(trim(c.faculty_name), ''), '') AS teacher,
        CASE
          WHEN tt.id IS NOT NULL
            THEN tt.start_time || ' - ' || tt.end_time
          ELSE ''
        END AS time,
        COALESCE(c.room, '') AS room,
        (SELECT count(*)::int FROM enrollments e WHERE e.workspace_subdomain = c.workspace_subdomain AND e.session_id = c.session_id AND e.class_id = c.id AND e.deleted_at IS NULL AND e.status <> 'cancelled') AS students,
        CASE WHEN tt.id IS NOT NULL THEN 'live' ELSE 'upcoming' END AS status
      FROM sessions s
      INNER JOIN session_classes c
        ON c.workspace_subdomain = s.workspace_subdomain
        AND c.session_id = s.id
      LEFT JOIN LATERAL (
        SELECT t.id, t.start_time, t.end_time
        FROM session_timetable t
        WHERE t.workspace_subdomain = s.workspace_subdomain
          AND t.session_id = s.id
          AND t.day = ${todayKey}
          AND (t.location = c.room OR c.room IS NULL OR c.room = '')
        LIMIT 1
      ) AS tt ON true
      WHERE s.workspace_subdomain = ${subdomain}
        AND s.deleted_at IS NULL
        AND s.status = 'in_progress'
      ORDER BY name ASC
    `);

    const capacity = getQueryRows<Record<string, unknown>>(capacityResult).map((row) => ({
      sessionId: String(row.sessionId ?? ''),
      classId: String(row.classId ?? ''),
      session: String(row.session ?? ''),
      class: String(row.class ?? ''),
      enrolled: Number(row.enrolled ?? 0),
      capacity: Number(row.capacity ?? 0),
      rate: Number(row.rate ?? 0),
      status: String(row.status ?? ''),
    }));

    const trendRows = getQueryRows<Record<string, unknown>>(trendResult);
    const enrollmentTrends: Array<{
      monthKey: string;
      students: number;
      sessionName: string | null;
    }> = [];
    for (let i = 0; i < trendRows.length; i++) {
      const row = trendRows[i];
      if (typeof row?.monthKey === 'string' && /^\d{4}-\d{2}$/.test(row.monthKey)) {
        enrollmentTrends.push({
          monthKey: row.monthKey,
          students: Number(row.students ?? 0),
          sessionName: row.sessionName == null || row.sessionName === '' ? null : String(row.sessionName),
        });
      }
    }

    const todaysSessions = getQueryRows<Record<string, unknown>>(todayResult).map((row) => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      teacher: String(row.teacher ?? ''),
      time: String(row.time ?? ''),
      room: String(row.room ?? ''),
      students: Number(row.students ?? 0),
      status: row.status === 'live' ? ('live' as const) : ('upcoming' as const),
    }));

    return { capacity, enrollmentTrends, todaysSessions };
  });
}
