import { and, eq, inArray, isNull } from "drizzle-orm";
import { enrollments } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { syncEnrolledSessionsTx } from "./enrollmentSessionSync.js";
import { enrollmentHoldsSeatWhere } from "./enrollmentSeatSql.js";

/** Students (of `studentIds`) that already hold a live, non-cancelled enrollment in the session. */
export async function findActivelyEnrolledStudentIds(
  tenant: string,
  sessionId: string,
  studentIds: string[],
): Promise<Set<string>> {
  const subdomain = tenant.trim().toLowerCase();
  if (studentIds.length === 0) return new Set();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.workspaceSubdomain, subdomain),
          eq(enrollments.sessionId, sessionId),
          inArray(enrollments.studentId, studentIds),
          isNull(enrollments.deletedAt),
          enrollmentHoldsSeatWhere(),
        ),
      );
    return new Set(rows.map((row) => row.studentId));
  });
}

/** Cancels the students' active enrollments in a session (history kept) and re-syncs membership. */
export async function cancelStudentEnrollmentsInSession(
  tenant: string,
  sessionId: string,
  studentIds: string[],
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  if (studentIds.length === 0) return 0;
  return withTenant(subdomain, async (tx) => {
    const cancelled = await tx
      .update(enrollments)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(enrollments.workspaceSubdomain, subdomain),
          eq(enrollments.sessionId, sessionId),
          inArray(enrollments.studentId, studentIds),
          isNull(enrollments.deletedAt),
          enrollmentHoldsSeatWhere(),
        ),
      )
      .returning({ id: enrollments.id });
    await syncEnrolledSessionsTx(tx, subdomain, { studentIds });
    return cancelled.length;
  });
}
