import { sql, type SQL } from "drizzle-orm";
import { enrollmentHoldsSeatSql } from "./enrollmentSeatSql.js";
import { getQueryRows } from "../documentStoreKeys.js";

type Executor = {
  execute: (query: SQL) => Promise<{ rows?: unknown }>;
};

export interface EnrollmentReportExtras {
  classFillRates: Array<{
    sessionId: string;
    classId: string;
    className: string;
    capacity: number;
    enrolled: number;
    fillPct: number | null;
    seatsLeft: number | null;
    waitlisted: number;
    demand: number;
  }>;
  retention: {
    started: number;
    dropped: number;
    completed: number;
    dropPct: number;
    retentionPct: number;
  };
}

/** Class occupancy/seat-demand and trailing retention — split out to keep the report file <300 lines. */
export async function loadEnrollmentReportExtras(
  tx: Executor,
  subdomain: string,
): Promise<EnrollmentReportExtras> {
  // Class occupancy + waitlist demand. Section capacity wins when the class has active
  // sections; capacity 0 means unlimited (the MMS convention), so fill is null there.
  const fillRows = getQueryRows<Record<string, unknown>>(
    await tx.execute(sql`
        WITH live AS (
          SELECT e.class_id, count(*)::int AS seats
          FROM enrollments e
          WHERE e.workspace_subdomain = ${subdomain}
            AND e.deleted_at IS NULL
            AND ${enrollmentHoldsSeatSql("e")}
          GROUP BY 1
        ),
        section_capacity AS (
          SELECT s.class_id, COALESCE(sum(s.capacity), 0)::int AS capacity, count(*)::int AS sections
          FROM session_class_sections s
          WHERE s.workspace_subdomain = ${subdomain} AND s.status = 'active'
          GROUP BY 1
        ),
        waitlist AS (
          SELECT ra.class_id, count(*)::int AS waiting
          FROM registration_applications ra
          WHERE ra.workspace_subdomain = ${subdomain}
            AND ra.status = 'waitlisted'
            AND ra.deleted_at IS NULL
          GROUP BY 1
        )
        SELECT sc.id AS "classId", sc.session_id AS "sessionId", sc.name AS "className",
               sc.capacity AS "classCapacity",
               COALESCE(sca.capacity, 0) AS "sectionCapacity",
               COALESCE(sca.sections, 0) AS "sectionCount",
               COALESCE(l.seats, 0) AS "enrolled",
               COALESCE(w.waiting, 0) AS "waitlisted"
        FROM session_classes sc
        LEFT JOIN live l ON l.class_id = sc.id
        LEFT JOIN section_capacity sca ON sca.class_id = sc.id
        LEFT JOIN waitlist w ON w.class_id = sc.id
        WHERE sc.workspace_subdomain = ${subdomain}
        ORDER BY COALESCE(l.seats, 0) DESC, sc.name ASC
        LIMIT 100
      `),
  );
  const classFillRates = fillRows.map((row) => {
    const sectionCount = Number(row.sectionCount ?? 0);
    const capacity =
      sectionCount > 0 ? Number(row.sectionCapacity ?? 0) : Number(row.classCapacity ?? 0);
    const enrolled = Number(row.enrolled ?? 0);
    const waitlisted = Number(row.waitlisted ?? 0);
    const seatsLeft = capacity > 0 ? Math.max(0, capacity - enrolled) : null;
    return {
      sessionId: String(row.sessionId ?? ""),
      classId: String(row.classId ?? ""),
      className: String(row.className ?? ""),
      capacity,
      enrolled,
      fillPct: capacity > 0 ? Math.round((enrolled / capacity) * 100) : null,
      seatsLeft,
      waitlisted,
      demand: seatsLeft === null ? 0 : Math.max(0, waitlisted - seatsLeft),
    };
  });

  const retentionRow = getQueryRows<Record<string, unknown>>(
    await tx.execute(sql`
        WITH scoped AS (
          SELECT e.status, count(*)::int AS count
          FROM enrollments e
          WHERE e.workspace_subdomain = ${subdomain}
            AND e.deleted_at IS NULL
            AND e.enrolled_on IS NOT NULL
            AND e.enrolled_on >= (CURRENT_DATE - interval '12 months')::date
          GROUP BY 1
        )
        SELECT COALESCE(sum(count), 0)::int AS started,
               COALESCE(sum(count) FILTER (WHERE status IN ('withdrawn', 'cancelled', 'left')), 0)::int AS dropped,
               COALESCE(sum(count) FILTER (WHERE status = 'completed'), 0)::int AS completed
        FROM scoped
      `),
  )[0];
  const started = Number(retentionRow?.started ?? 0);
  const dropped = Number(retentionRow?.dropped ?? 0);
  const dropPct = started > 0 ? Math.round((dropped / started) * 100) : 0;
  const retention = {
    started,
    dropped,
    completed: Number(retentionRow?.completed ?? 0),
    dropPct,
    retentionPct: started > 0 ? Math.max(0, 100 - dropPct) : 0,
  };

  return { classFillRates, retention };
}
