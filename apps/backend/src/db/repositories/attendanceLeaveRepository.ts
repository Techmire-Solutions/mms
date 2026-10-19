import { randomUUID } from "node:crypto";
import { and, eq, gte, lte, sql } from "drizzle-orm";
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
