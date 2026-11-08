import { randomUUID } from "node:crypto";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { attendanceLeaves } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";

/** Approved leave ranges of a student that overlap [fromOn, toOn]. */
export async function findOverlappingApprovedLeaves(
  tenant: string,
  studentId: string,
  fromOn: string,
  toOn: string,
): Promise<{ id: string; fromDate: string | null; toDate: string | null }[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, (tx) =>
    tx
      .select({
        id: attendanceLeaves.id,
        fromDate: attendanceLeaves.fromDate,
        toDate: attendanceLeaves.toDate,
      })
      .from(attendanceLeaves)
      .where(
        and(
          eq(attendanceLeaves.workspaceSubdomain, subdomain),
          eq(attendanceLeaves.studentId, studentId),
          sql`lower(${attendanceLeaves.status}) = 'approved'`,
          lte(attendanceLeaves.fromDate, toOn),
          gte(attendanceLeaves.toDate, fromOn),
        ),
      ),
  );
}

/** Records an already-approved leave range (suspension / long leave). */
export async function insertApprovedLeave(
  tenant: string,
  leave: { studentId: string; fromOn: string; toOn: string; reason: string; approvedBy: string },
): Promise<string> {
  const subdomain = tenant.trim().toLowerCase();
  const id = randomUUID();
  await withTenant(subdomain, (tx) =>
    tx.insert(attendanceLeaves).values({
      id,
      workspaceSubdomain: subdomain,
      studentId: leave.studentId,
      fromDate: leave.fromOn,
      toDate: leave.toOn,
      reason: leave.reason,
      status: "approved",
      approvedBy: leave.approvedBy,
      approvedAt: new Date(),
    }),
  );
  return id;
}

export type InsertApprovedLeaveResult =
  | { ok: true; id: string }
  | { ok: false; conflict: { fromDate: string | null; toDate: string | null } };

/**
 * Records an approved leave range only when it does not overlap an existing one.
 *
 * The check and the insert share **one transaction** serialized by a per-student advisory lock:
 * without it, two concurrent suspensions both pass the overlap probe and both insert, because
 * `attendance_leaves` has no exclusion constraint on the range. The lock is transaction-scoped, so
 * it is released on commit/rollback with the write.
 */
export async function insertApprovedLeaveIfFree(
  tenant: string,
  leave: { studentId: string; fromOn: string; toOn: string; reason: string; approvedBy: string },
): Promise<InsertApprovedLeaveResult> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    // Same per-student lock the marking path takes, so an approval can never race a mark write.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`attendance:student:${subdomain}:${leave.studentId}`}))`,
    );

    const [overlapping] = await tx
      .select({
        id: attendanceLeaves.id,
        fromDate: attendanceLeaves.fromDate,
        toDate: attendanceLeaves.toDate,
      })
      .from(attendanceLeaves)
      .where(
        and(
          eq(attendanceLeaves.workspaceSubdomain, subdomain),
          eq(attendanceLeaves.studentId, leave.studentId),
          sql`lower(${attendanceLeaves.status}) = 'approved'`,
          lte(attendanceLeaves.fromDate, leave.toOn),
          gte(attendanceLeaves.toDate, leave.fromOn),
        ),
      )
      .limit(1);

    if (overlapping) {
      return {
        ok: false as const,
        conflict: { fromDate: overlapping.fromDate, toDate: overlapping.toDate },
      };
    }

    const id = randomUUID();
    const now = new Date();
    await tx.insert(attendanceLeaves).values({
      id,
      workspaceSubdomain: subdomain,
      studentId: leave.studentId,
      fromDate: leave.fromOn,
      toDate: leave.toOn,
      reason: leave.reason,
      status: "approved",
      approvedBy: leave.approvedBy,
      approvedAt: now,
      reviewedBy: leave.approvedBy,
      reviewedAt: now,
      submittedBy: leave.approvedBy,
      submittedAt: now,
    });
    return { ok: true as const, id };
  });
}

/**
 * Approved leaves of the given students overlapping `[fromOn, toOn]`.
 *
 * One query for a whole roster: the caller resolves per-day coverage in memory instead of issuing a
 * lookup per row.
 */
export async function listApprovedLeavesFor(
  tenant: string,
  studentIds: string[],
  fromOn: string,
  toOn: string,
): Promise<Array<{ studentId: string; fromDate: string | null; toDate: string | null }>> {
  const subdomain = tenant.trim().toLowerCase();
  const ids = [...new Set(studentIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];
  return withTenantRead(subdomain, (tx) =>
    tx
      .select({
        studentId: attendanceLeaves.studentId,
        fromDate: attendanceLeaves.fromDate,
        toDate: attendanceLeaves.toDate,
      })
      .from(attendanceLeaves)
      .where(
        and(
          eq(attendanceLeaves.workspaceSubdomain, subdomain),
          inArray(attendanceLeaves.studentId, ids),
          sql`lower(${attendanceLeaves.status}) = 'approved'`,
          lte(attendanceLeaves.fromDate, toOn),
          gte(attendanceLeaves.toDate, fromOn),
        ),
      ),
  );
}
