import { sql } from "drizzle-orm";
import { type Session } from "@mms/shared";
import { type sessionFaculty, type sessionClasses } from "../schema.js";
import { type TenantTransaction } from "../tenant-context.js";
import { sessionRowToRecord } from "./sessionRepositoryMappers.js";
import {
  hydrateSessionsListAggregated,
  type SessionRow,
} from "./sessionRepositoryHydrateAggregated.js";
import { hydrateSessionsListBatched } from "./sessionRepositoryHydrateBatched.js";
import { enrollmentHoldsSeatSql } from "./enrollmentSeatSql.js";

export {
  listSessionsByWorkspace,
  findSessionById,
  findSessionsByIds,
  findSessionsSummaryByIds,
  findClassesByIds,
  findClassById,
} from "./sessionRepositoryQueries.js";

export { hydrateSessionsListAggregated, type SessionRow };

type Transaction = TenantTransaction;
type SessionFacultyRow = typeof sessionFaculty.$inferSelect;
type ClassRow = typeof sessionClasses.$inferSelect;

export const SESSION_HYDRATION_BATCH_SIZE = 250;

export async function hydrateSessionsList(
  tx: Transaction,
  subdomain: string,
  sessionRows: SessionRow[],
): Promise<Session[]> {
  if (sessionRows.length === 0) return [];
  if (sessionRows.length > SESSION_HYDRATION_BATCH_SIZE) {
    const results: Session[] = [];
    for (let i = 0; i < sessionRows.length; i += SESSION_HYDRATION_BATCH_SIZE) {
      const slice = sessionRows.slice(i, i + SESSION_HYDRATION_BATCH_SIZE);
      const batch = await hydrateSessionsList(tx, subdomain, slice);
      results.push(...batch);
    }
    return results;
  }

  // Attempt consolidated O(1) SQL aggregation when tx.execute is available
  if (
    process.env.MMS_DISABLE_AGGREGATED_CHILD_HYDRATION !== "true" &&
    typeof (tx as { execute?: unknown })?.execute === "function"
  ) {
    try {
      return await hydrateSessionsListAggregated(tx, subdomain, sessionRows);
    } catch {
      // Fallback to batched queries when execute fails (e.g., partial mock dialect)
    }
  }

  return hydrateSessionsListBatched(tx, subdomain, sessionRows);
}

/**
 * Lean hydration for the Work list: loads `classes` & `faculty` counts for the directory cards/table.
 */
export async function hydrateSessionsListSummary(
  tx: Transaction,
  subdomain: string,
  sessionRows: SessionRow[],
): Promise<Session[]> {
  if (sessionRows.length === 0) return [];
  if (sessionRows.length > SESSION_HYDRATION_BATCH_SIZE) {
    const results: Session[] = [];
    for (let i = 0; i < sessionRows.length; i += SESSION_HYDRATION_BATCH_SIZE) {
      const slice = sessionRows.slice(i, i + SESSION_HYDRATION_BATCH_SIZE);
      const batch = await hydrateSessionsListSummary(tx, subdomain, slice);
      results.push(...batch);
    }
    return results;
  }
  const sessionIds = sessionRows.map((s) => s.id);

  const queryResult = await (tx as { execute: (q: unknown) => Promise<unknown> }).execute(sql`
    SELECT
      s.id AS "sessionId",
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', f.id,
          'sessionId', f.session_id,
          'workspaceSubdomain', f.workspace_subdomain,
          'facultyId', f.faculty_id,
          'facultyName', f.faculty_name,
          'role', f.role,
          'status', f.status,
          'createdAt', f.created_at
        ))
        FROM session_faculty f
        WHERE f.session_id = s.id AND f.workspace_subdomain = ${subdomain}
      ), '[]'::json) AS faculty,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', c.id,
          'sessionId', c.session_id,
          'workspaceSubdomain', c.workspace_subdomain,
          'name', c.name,
          'ageMin', c.age_min,
          'ageMax', c.age_max,
          'gender', c.gender,
          'facultyId', c.faculty_id,
          'facultyName', c.faculty_name,
          'capacity', c.capacity,
          'enrolled', (SELECT count(*)::int FROM enrollments e WHERE e.workspace_subdomain = c.workspace_subdomain AND e.session_id = c.session_id AND e.class_id = c.id AND e.deleted_at IS NULL AND ${enrollmentHoldsSeatSql("e")}),
          'room', c.room,
          'programId', c.program_id,
          'sortOrder', c.sort_order,
          'createdAt', c.created_at
        ) ORDER BY c.sort_order)
        FROM session_classes c
        WHERE c.session_id = s.id AND c.workspace_subdomain = ${subdomain}
      ), '[]'::json) AS classes
    FROM (VALUES ${sql.join(
      sessionIds.map((id) => sql`(${id}::text)`),
      sql`, `,
    )}) AS s(id)
  `);

  const rows = (
    Array.isArray(queryResult) ? queryResult : ((queryResult as { rows?: unknown[] })?.rows ?? [])
  ) as Array<{
    sessionId: unknown;
    faculty?: SessionFacultyRow[];
    classes?: ClassRow[];
  }>;
  const facultyBySession = new Map<string, SessionFacultyRow[]>();
  const classesBySession = new Map<string, ClassRow[]>();
  for (const row of rows) {
    const sid = String(row.sessionId);
    if (Array.isArray(row.faculty)) facultyBySession.set(sid, row.faculty);
    if (Array.isArray(row.classes)) classesBySession.set(sid, row.classes);
  }

  return sessionRows.map((row) =>
    sessionRowToRecord(row, facultyBySession.get(row.id) ?? [], classesBySession.get(row.id) ?? []),
  );
}
