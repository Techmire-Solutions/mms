import { sql } from "drizzle-orm";
import type { SessionsReportAggregates, SessionsReportQuery } from "@mms/shared";
import { getQueryRows } from "../documentStoreKeys.js";
import { withTenantRead } from "../tenant-context.js";
import { enrollmentHoldsSeatSql } from "./enrollmentSeatSql.js";
import { workspaceTodayIso } from "../../lib/workspaceDay.js";

const DEFAULT_TREND_MONTHS = 12;
const STATUSES_ACTIVE = sql`'open', 'in_progress'`;

function shiftMonths(iso: string, months: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

function includeCompletedFlag(options: SessionsReportQuery): boolean {
  return options.includeCompleted === true || options.includeCompleted === "true";
}

/**
 * SQL aggregates for Sessions Reports: capacity/seat balance, enrollment trends, today's classes,
 * and completion outcomes. All "today" work uses the workspace timezone; the timetable source is
 * the canonical class timetable tables (the legacy session_timetable table is no longer written).
 */
export async function loadSessionsReportAggregatesSql(
  tenant: string,
  options: SessionsReportQuery = {},
): Promise<SessionsReportAggregates> {
  const subdomain = tenant.trim().toLowerCase();
  const todayIso = await workspaceTodayIso(subdomain);
  const includeCompleted = includeCompletedFlag(options);
  const from = options.from ?? shiftMonths(todayIso, DEFAULT_TREND_MONTHS);
  const to = options.to ?? todayIso;
  const activeOnly = includeCompleted ? sql`` : sql`AND s.status IN (${STATUSES_ACTIVE})`;

  return withTenantRead(subdomain, async (tx) => {
    const capacityResult = await tx.execute(sql`
      SELECT
        s.id AS "sessionId",
        c.id AS "classId",
        s.name AS session,
        c.name AS class,
        ce.enrolled AS enrolled,
        c.capacity AS capacity,
        GREATEST(c.capacity - ce.enrolled, 0)::int AS "freeSeats",
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
      CROSS JOIN LATERAL (
        SELECT count(*)::int AS enrolled
        FROM enrollments e
        WHERE e.workspace_subdomain = c.workspace_subdomain
          AND e.session_id = c.session_id
          AND e.class_id = c.id
          AND e.deleted_at IS NULL
          AND ${enrollmentHoldsSeatSql("e")}
      ) ce
      WHERE s.workspace_subdomain = ${subdomain}
        AND s.deleted_at IS NULL
        ${activeOnly}
      ORDER BY s.name ASC, c.name ASC
    `);

    const trendResult = await tx.execute(sql`
      SELECT
        to_char(date_trunc('month', e.enrolled_on::timestamp), 'YYYY-MM') AS "monthKey",
        NULLIF(trim(s.name), '') AS "sessionName",
        count(*)::int AS cnt
      FROM enrollments e
      LEFT JOIN sessions s
        ON s.workspace_subdomain = e.workspace_subdomain
        AND s.id = e.session_id
        AND s.deleted_at IS NULL
      WHERE e.workspace_subdomain = ${subdomain}
        AND e.deleted_at IS NULL
        AND e.enrolled_on IS NOT NULL
        AND e.enrolled_on >= ${from}::date
        AND e.enrolled_on <= ${to}::date
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `);

    const todayResult = await tx.execute(sql`
      SELECT
        (s.id || '-' || c.id) AS id,
        (s.name || ' – ' || c.name) AS name,
        COALESCE(NULLIF(trim(c.faculty_name), ''), tt.teacher, '') AS teacher,
        COALESCE(tt.start_time || ' - ' || tt.end_time, '') AS time,
        COALESCE(c.room, '') AS room,
        (
          SELECT count(*)::int
          FROM enrollments e
          WHERE e.workspace_subdomain = c.workspace_subdomain
            AND e.session_id = c.session_id
            AND e.class_id = c.id
            AND e.deleted_at IS NULL
            AND ${enrollmentHoldsSeatSql("e")}
        ) AS students,
        CASE WHEN tt.start_time IS NOT NULL THEN 'live' ELSE 'upcoming' END AS status
      FROM sessions s
      INNER JOIN session_classes c
        ON c.workspace_subdomain = s.workspace_subdomain
        AND c.session_id = s.id
      LEFT JOIN LATERAL (
        SELECT
          min(p.start_time) AS start_time,
          max(p.end_time) AS end_time,
          (
            array_agg(NULLIF(trim(p.faculty_name), ''))
              FILTER (WHERE NULLIF(trim(p.faculty_name), '') IS NOT NULL)
          )[1] AS teacher
        FROM session_class_timetables t
        INNER JOIN session_class_timetable_periods p
          ON p.workspace_subdomain = t.workspace_subdomain
          AND p.timetable_id = t.id
        WHERE t.workspace_subdomain = s.workspace_subdomain
          AND t.session_class_id = c.id
          AND t.date = ${todayIso}::date
      ) AS tt ON true
      WHERE s.workspace_subdomain = ${subdomain}
        AND s.deleted_at IS NULL
        AND s.status = 'in_progress'
      ORDER BY name ASC
    `);

    const completionResult = await tx.execute(sql`
      SELECT
        s.id AS "sessionId",
        s.name AS session,
        count(*) FILTER (WHERE e.completion_status = 'completed')::int AS completed,
        count(*) FILTER (WHERE e.completion_status = 'not_completed')::int AS "notCompleted"
      FROM sessions s
      LEFT JOIN enrollments e
        ON e.workspace_subdomain = s.workspace_subdomain
        AND e.session_id = s.id
        AND e.deleted_at IS NULL
      WHERE s.workspace_subdomain = ${subdomain}
        AND s.deleted_at IS NULL
        ${activeOnly}
      GROUP BY s.id, s.name
      HAVING count(*) FILTER (WHERE e.completion_status IS NOT NULL) > 0
      ORDER BY s.name ASC
    `);

    const capacity = getQueryRows<Record<string, unknown>>(capacityResult).map((row) => ({
      sessionId: String(row.sessionId ?? ""),
      classId: String(row.classId ?? ""),
      session: String(row.session ?? ""),
      class: String(row.class ?? ""),
      enrolled: Number(row.enrolled ?? 0),
      capacity: Number(row.capacity ?? 0),
      freeSeats: Number(row.freeSeats ?? 0),
      rate: Number(row.rate ?? 0),
      status: String(row.status ?? ""),
    }));

    const trendRows = getQueryRows<Record<string, unknown>>(trendResult);
    const enrollmentTrends: Array<{
      monthKey: string;
      students: number;
      sessionName: string | null;
    }> = [];
    for (const row of trendRows) {
      if (typeof row?.monthKey === "string" && /^\d{4}-\d{2}$/.test(row.monthKey)) {
        enrollmentTrends.push({
          monthKey: row.monthKey,
          students: Number(row.students ?? 0),
          sessionName:
            row.sessionName == null || row.sessionName === "" ? null : String(row.sessionName),
        });
      }
    }

    const todaysSessions = getQueryRows<Record<string, unknown>>(todayResult).map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      teacher: String(row.teacher ?? ""),
      time: String(row.time ?? ""),
      room: String(row.room ?? ""),
      students: Number(row.students ?? 0),
      status: row.status === "live" ? ("live" as const) : ("upcoming" as const),
    }));

    const completion = getQueryRows<Record<string, unknown>>(completionResult).map((row) => {
      const completed = Number(row.completed ?? 0);
      const notCompleted = Number(row.notCompleted ?? 0);
      const finished = completed + notCompleted;
      return {
        sessionId: String(row.sessionId ?? ""),
        session: String(row.session ?? ""),
        completed,
        notCompleted,
        rate: finished > 0 ? Math.round((completed / finished) * 100) : 0,
      };
    });

    return { capacity, enrollmentTrends, todaysSessions, completion };
  });
}
