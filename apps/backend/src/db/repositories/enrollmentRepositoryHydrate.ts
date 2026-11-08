import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { dedupeTrimmedIds, SEAT_RELEASED_ENROLLMENT_STATUSES, type Enrollment } from "@mms/shared";
import { enrollments } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";
import {
  ENROLLMENT_COLUMNS,
  enrollmentRowToRecord,
  loadTimelineMapTx,
} from "./enrollmentProjection.js";

export { enrollmentRowToRecord } from "./enrollmentProjection.js";

export async function listEnrollmentsByWorkspace(
  tenant: string,
  options?: { limit?: number; offset?: number },
): Promise<Enrollment[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(ENROLLMENT_COLUMNS)
      .from(enrollments)
      .where(and(eq(enrollments.workspaceSubdomain, subdomain), isNull(enrollments.deletedAt)))
      .orderBy(enrollments.id)
      .limit(limit)
      .offset(offset);
    if (rows.length === 0) return [];
    const timeline = await loadTimelineMapTx(
      tx,
      subdomain,
      rows.map((row) => row.id),
    );
    return rows.map((row) => enrollmentRowToRecord(row, timeline.get(row.id)));
  });
}

export async function findEnrollmentById(
  tenant: string,
  id: string,
  options?: { includeDeleted?: boolean },
): Promise<Enrollment | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    // Trash/restore callers must opt in: `tenant_soft_delete_isolation` (FORCE RLS)
    // hides archived rows, which made a restore look like a 404.
    if (options?.includeDeleted) await enableIncludeDeleted(tx);
    const [row] = await tx
      .select(ENROLLMENT_COLUMNS)
      .from(enrollments)
      .where(and(eq(enrollments.workspaceSubdomain, subdomain), eq(enrollments.id, id)));
    if (!row) return null;
    const timeline = await loadTimelineMapTx(tx, subdomain, [row.id]);
    return enrollmentRowToRecord(row, timeline.get(row.id));
  });
}

export async function findEnrollmentsByIds(
  tenant: string,
  ids: string[],
  options?: { includeDeleted?: boolean },
): Promise<Enrollment[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    if (options?.includeDeleted) await enableIncludeDeleted(tx);
    const conditions = [
      eq(enrollments.workspaceSubdomain, subdomain),
      inArray(enrollments.id, cleanIds),
    ];
    if (!options?.includeDeleted) conditions.push(isNull(enrollments.deletedAt));
    const rows = await tx
      .select(ENROLLMENT_COLUMNS)
      .from(enrollments)
      .where(and(...conditions));
    if (rows.length === 0) return [];
    const timeline = await loadTimelineMapTx(tx, subdomain, cleanIds);
    return rows.map((row) => enrollmentRowToRecord(row, timeline.get(row.id)));
  });
}

/** Live (seat-holding) enrollment of a student in a session — the pair the unique index guards. */
export async function findActiveEnrollmentInSession(
  tenant: string,
  sessionId: string,
  studentId: string,
): Promise<Enrollment | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [row] = await tx
      .select(ENROLLMENT_COLUMNS)
      .from(enrollments)
      .where(
        and(
          eq(enrollments.workspaceSubdomain, subdomain),
          eq(enrollments.sessionId, sessionId),
          eq(enrollments.studentId, studentId),
          isNull(enrollments.deletedAt),
          notInArray(enrollments.status, [...SEAT_RELEASED_ENROLLMENT_STATUSES]),
        ),
      )
      .limit(1);
    if (!row) return null;
    const timeline = await loadTimelineMapTx(tx, subdomain, [row.id]);
    return enrollmentRowToRecord(row, timeline.get(row.id));
  });
}
