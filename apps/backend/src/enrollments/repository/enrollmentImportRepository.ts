import { sql } from "drizzle-orm";
import { SEAT_RELEASED_ENROLLMENT_STATUSES, type Session } from "@mms/shared";
import { withTenantRead } from "../../db/tenant-context.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryHydrate.js";
import { findStudentById } from "../../db/repositories/studentRepositoryHydrate.js";
import { findWorkspaceTimezone } from "../../db/repositories/workspaceRepository.js";
import type { EnrollmentImportRow } from "../use-cases/enrollmentImportUseCases.js";

interface StudentMatchRow {
  id: string;
}

export async function lookupImportStudentIds(
  tenant: string,
  row: EnrollmentImportRow,
): Promise<Array<{ id: string }>> {
  const subdomain = tenant.trim().toLowerCase();
  const idValue = (row.studentId ?? "").trim();
  const nameValue = (row.studentName ?? "").trim();
  if (!idValue && !nameValue) return [];
  // Exact identifier (students.id / student_id / gr_number) or exact contact name.
  const result = await withTenantRead(subdomain, (tx) =>
    tx.execute<StudentMatchRow & Record<string, unknown>>(sql`
      SELECT DISTINCT s.id
        FROM students s
        LEFT JOIN contacts c
          ON c.workspace_subdomain = s.workspace_subdomain AND c.id = s.contact_id
       WHERE s.workspace_subdomain = ${subdomain}
         AND s.deleted_at IS NULL
         AND (
           (${idValue} <> '' AND (s.id = ${idValue} OR s.student_id = ${idValue} OR s.gr_number = ${idValue}))
           OR (${idValue} = '' AND ${nameValue} <> '' AND lower(btrim(c.name)) = lower(btrim(${nameValue})))
         )
       LIMIT 5
    `),
  );
  return result.rows as Array<{ id: string }>;
}

export async function lookupImportSessionIds(
  tenant: string,
  row: EnrollmentImportRow,
): Promise<Array<{ id: string }>> {
  const subdomain = tenant.trim().toLowerCase();
  const idValue = (row.sessionId ?? "").trim();
  const nameValue = (row.sessionName ?? "").trim();
  if (!idValue && !nameValue) return [];
  const result = await withTenantRead(subdomain, (tx) =>
    tx.execute<{ id: string }>(sql`
      SELECT s.id
        FROM sessions s
       WHERE s.workspace_subdomain = ${subdomain}
         AND s.deleted_at IS NULL
         AND (
           (${idValue} <> '' AND s.id = ${idValue})
           OR (${idValue} = '' AND ${nameValue} <> '' AND lower(btrim(s.name)) = lower(btrim(${nameValue})))
         )
       LIMIT 3
    `),
  );
  return result.rows as Array<{ id: string }>;
}

export async function hasLiveEnrollmentInSession(
  tenant: string,
  studentId: string,
  sessionId: string,
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  const result = await withTenantRead(subdomain, (tx) =>
    tx.execute<{ id: string }>(sql`
      SELECT e.id FROM enrollments e
       WHERE e.workspace_subdomain = ${subdomain}
         AND e.student_id = ${studentId}
         AND e.session_id = ${sessionId}
         AND e.deleted_at IS NULL
         AND e.status NOT IN (${sql.join(
           [...SEAT_RELEASED_ENROLLMENT_STATUSES].map((status) => sql`${status}`),
           sql`, `,
         )})
       LIMIT 1
    `),
  );
  return result.rows.length > 0;
}

export async function getHydratedStudentForImport(tenant: string, studentId: string) {
  return findStudentById(tenant, studentId);
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
