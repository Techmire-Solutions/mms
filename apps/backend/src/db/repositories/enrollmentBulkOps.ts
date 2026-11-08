import { and, eq, inArray, isNull } from "drizzle-orm";
import { enrollments } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { enrollmentHoldsSeatWhere } from "./enrollmentSeatSql.js";

/** Students (of `studentIds`) that already hold a live, non-cancelled enrollment in the session. */
export async function findActivelyEnrolledStudentIds(
  tenant: string,
  sessionId: string,
  studentIds: string[],
): Promise<Set<string>> {
  const subdomain = tenant.trim().toLowerCase();
  if (studentIds.length === 0) return new Set();
  // Primary, not the read replica: this is the fast duplicate pre-check immediately
  // before a write, and replica lag would let a just-created enrollment through. The
  // partial unique index on `enrollments` is still the authority under concurrency.
  return withTenant(subdomain, async (tx) => {
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
