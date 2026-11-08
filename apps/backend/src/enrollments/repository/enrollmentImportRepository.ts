import { sql } from "drizzle-orm";
import { SEAT_RELEASED_ENROLLMENT_STATUSES, type Session } from "@mms/shared";
import { withTenantRead } from "../../db/tenant-context.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryHydrate.js";
import { findWorkspaceTimezone } from "../../db/repositories/workspaceRepository.js";

export interface ImportStudentRow {
  id: string;
  studentId: string | null;
  grNumber: string | null;
  name: string;
  discountType: string | null;
  discountPct: string | null;
}

export interface ImportSessionRow {
  id: string;
  name: string;
}

const list = (values: readonly string[]) =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );

/**
 * Resolves every student referenced by a chunk in ONE query (ids, GR/student ids and
 * exact contact names). Replaces the per-row N+1 lookups of the first import version.
 */
export async function lookupImportStudentsBulk(
  tenant: string,
  keys: { identifiers: readonly string[]; names: readonly string[] },
): Promise<ImportStudentRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  const identifiers = [...new Set(keys.identifiers.map((value) => value.trim()).filter(Boolean))];
  const names = [...new Set(keys.names.map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (identifiers.length === 0 && names.length === 0) return [];
  const result = await withTenantRead(subdomain, (tx) =>
    tx.execute<ImportStudentRow & Record<string, unknown>>(sql`
      SELECT DISTINCT s.id, s.student_id AS "studentId", s.gr_number AS "grNumber",
             coalesce(c.name, '') AS name,
             s.discount_type AS "discountType", s.discount_pct::text AS "discountPct"
        FROM students s
        LEFT JOIN contacts c
          ON c.workspace_subdomain = s.workspace_subdomain AND c.id = s.contact_id
       WHERE s.workspace_subdomain = ${subdomain}
         AND s.deleted_at IS NULL
         AND (
           ${identifiers.length > 0 ? sql`(s.id IN (${list(identifiers)}) OR s.student_id IN (${list(identifiers)}) OR s.gr_number IN (${list(identifiers)}))` : sql`false`}
           ${names.length > 0 ? sql`OR (lower(btrim(c.name)) IN (${list(names)}))` : sql``}
         )
    `),
  );
  return result.rows as ImportStudentRow[];
}

/** Resolves every session referenced by a chunk in one query (ids and exact names). */
export async function lookupImportSessionsBulk(
  tenant: string,
  keys: { ids: readonly string[]; names: readonly string[] },
): Promise<ImportSessionRow[]> {
  const subdomain = tenant.trim().toLowerCase();
  const ids = [...new Set(keys.ids.map((value) => value.trim()).filter(Boolean))];
  const names = [...new Set(keys.names.map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (ids.length === 0 && names.length === 0) return [];
  const result = await withTenantRead(subdomain, (tx) =>
    tx.execute<ImportSessionRow & Record<string, unknown>>(sql`
      SELECT s.id, s.name
        FROM sessions s
       WHERE s.workspace_subdomain = ${subdomain}
         AND s.deleted_at IS NULL
         AND (
           ${ids.length > 0 ? sql`(s.id IN (${list(ids)}))` : sql`false`}
           ${names.length > 0 ? sql`OR (lower(btrim(s.name)) IN (${list(names)}))` : sql``}
         )
    `),
  );
  return result.rows as ImportSessionRow[];
}

/** Existing live (student, session) enrollments before the import starts. */
export async function lookupLiveEnrollmentPairs(
  tenant: string,
  studentIds: readonly string[],
  sessionIds: readonly string[],
): Promise<Array<{ studentId: string; sessionId: string }>> {
  const subdomain = tenant.trim().toLowerCase();
  const students = [...new Set(studentIds.map(String).filter(Boolean))];
  const sessions = [...new Set(sessionIds.map(String).filter(Boolean))];
  if (students.length === 0 || sessions.length === 0) return [];
  const result = await withTenantRead(subdomain, (tx) =>
    tx.execute<{ studentId: string; sessionId: string } & Record<string, unknown>>(sql`
      SELECT e.student_id AS "studentId", e.session_id AS "sessionId"
        FROM enrollments e
       WHERE e.workspace_subdomain = ${subdomain}
         AND e.student_id IN (${list(students)})
         AND e.session_id IN (${list(sessions)})
         AND e.deleted_at IS NULL
         AND e.status NOT IN (${list([...SEAT_RELEASED_ENROLLMENT_STATUSES])})
    `),
  );
  return result.rows as Array<{ studentId: string; sessionId: string }>;
}

export async function getHydratedSessionForImport(
  tenant: string,
  sessionId: string,
): Promise<Session | null> {
  return findSessionById(tenant, sessionId);
}

export async function getTimezoneForImport(tenant: string): Promise<string | null> {
  return findWorkspaceTimezone(tenant);
}
