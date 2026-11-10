/**
 * Award-scope lookups — which classes an instructor teaches, and whether a student is in one.
 *
 * The RBAC model is collection-wide, so "an instructor may only award within their scope" needs an
 * ownership join: `tenant_users → faculty.user_id → session_classes.faculty_id → enrollments`.
 * Reads only; the rule lives in the use-case layer.
 */

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { SEAT_RELEASED_ENROLLMENT_STATUSES } from "@mms/shared";
import { enrollments, faculty, sessionClasses, tenantUsers } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

const RELEASED = [...SEAT_RELEASED_ENROLLMENT_STATUSES];

/** `faculty.id` linked to a login user, or null when the user has no staff record. */
export async function findFacultyIdForUser(tenant: string, userId: string): Promise<string | null> {
  const trimmedUserId = userId?.trim();
  if (!trimmedUserId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select({ id: faculty.id })
      .from(faculty)
      .where(
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          eq(faculty.userId, trimmedUserId),
          isNull(faculty.deletedAt),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  });
}

/** Ids of the session classes where `facultyId` is the assigned instructor. */
export async function listClassIdsTaughtByFaculty(
  tenant: string,
  facultyId: string,
): Promise<string[]> {
  const trimmed = facultyId?.trim();
  if (!trimmed) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: sessionClasses.id })
      .from(sessionClasses)
      .where(
        and(
          eq(sessionClasses.workspaceSubdomain, subdomain),
          eq(sessionClasses.facultyId, trimmed),
        ),
      );
    return rows.map((row) => row.id);
  });
}

/** Subset of `studentIds` enrolled (live) in one of the instructor's classes. */
export async function filterStudentsInFacultyClasses(
  tenant: string,
  facultyId: string,
  studentIds: readonly string[],
): Promise<string[]> {
  const ids = Array.from(new Set(studentIds.map((id) => id?.trim()).filter(Boolean)));
  if (ids.length === 0) return [];
  const trimmed = facultyId?.trim();
  if (!trimmed) return [];
  const subdomain = tenant.trim().toLowerCase();

  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .innerJoin(
        sessionClasses,
        and(
          eq(sessionClasses.workspaceSubdomain, enrollments.workspaceSubdomain),
          eq(sessionClasses.sessionId, enrollments.sessionId),
          eq(sessionClasses.id, enrollments.classId),
        ),
      )
      .where(
        and(
          eq(enrollments.workspaceSubdomain, subdomain),
          isNull(enrollments.deletedAt),
          sql`${enrollments.status} NOT IN (${sql.join(
            RELEASED.map((status) => sql`${status}`),
            sql`, `,
          )})`,
          eq(sessionClasses.facultyId, trimmed),
          inArray(enrollments.studentId, ids),
        ),
      )
      .groupBy(enrollments.studentId);
    return rows.map((row) => row.studentId);
  });
}

/** Role of a tenant user (used by background jobs, which carry no `User` object). */
export async function findTenantUserRole(tenant: string, userId: string): Promise<string | null> {
  const trimmed = userId?.trim();
  if (!trimmed) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select({ role: tenantUsers.role })
      .from(tenantUsers)
      .where(
        and(
          eq(tenantUsers.workspaceSubdomain, subdomain),
          eq(tenantUsers.id, trimmed),
          isNull(tenantUsers.deletedAt),
        ),
      )
      .limit(1);
    return row?.role ?? null;
  });
}
