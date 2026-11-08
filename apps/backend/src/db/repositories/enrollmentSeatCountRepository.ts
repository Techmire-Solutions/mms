import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { SEAT_RELEASED_ENROLLMENT_STATUSES } from "@mms/shared";
import { enrollments } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { SeatCapacityError } from "../../lib/httpErrors.js";

/** Advisory lock for a rollover carry on one target session (released with the ambient tx). */
export async function lockRolloverCarryTx(tenant: string, targetSessionId: string): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, (tx) =>
    tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`${subdomain}:rollover-carry:${targetSessionId}`}))`,
    ),
  );
}

export interface LiveSeatCount {
  classId: string;
  sectionId: string | null;
  count: number;
}

/** Live (seat-holding) enrollment counts per class/section of one session, for quota checks. */
export async function countLiveSeatsByClassTx(
  tenant: string,
  sessionId: string,
): Promise<LiveSeatCount[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx.execute<{ classId: string; sectionId: string | null; count: number }>(sql`
      SELECT class_id AS "classId", section_id AS "sectionId", count(*)::int AS count
        FROM enrollments
       WHERE workspace_subdomain = ${subdomain} AND session_id = ${sessionId}
         AND deleted_at IS NULL
         AND status NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left')
       GROUP BY class_id, section_id
    `);
    return rows.rows.map((row) => ({
      classId: row.classId,
      sectionId: row.sectionId,
      count: Number(row.count),
    }));
  });
}

export interface LockedSeatSection {
  id: string;
  classId: string;
  name: string;
  status: string;
  capacity: number;
}

/**
 * Row-locks the sections a write is about to seat students in, in a deterministic order.
 *
 * A lock on `session_class_sections` is the serialization point for seat allocation:
 * every writer takes it before counting, so two concurrent enrollments cannot both
 * observe the last free seat (READ COMMITTED: the second waiter re-counts after the
 * first commits). Ordering by id avoids deadlocks when two batches overlap.
 */
export async function lockSectionsForSeatsTx(
  tx: TenantTransaction,
  subdomain: string,
  sectionIds: readonly string[],
): Promise<Map<string, LockedSeatSection>> {
  const ids = [...new Set(sectionIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const rows = await tx.execute<{
    id: string;
    classId: string;
    name: string;
    status: string;
    capacity: number;
  }>(sql`
    SELECT id, class_id AS "classId", name, status, capacity
      FROM session_class_sections
     WHERE workspace_subdomain = ${subdomain}
       AND id IN (${sql.join(
         ids.map((id) => sql`${id}`),
         sql`, `,
       )})
     ORDER BY id
       FOR UPDATE
  `);
  return new Map(
    rows.rows.map((row) => [
      row.id,
      {
        id: row.id,
        classId: row.classId,
        name: row.name,
        status: row.status,
        capacity: Number(row.capacity ?? 0),
      },
    ]),
  );
}

/** Live (seat-holding, not deleted) enrollment counts per section, after the locks are held. */
export async function countLiveSeatsBySectionTx(
  tx: TenantTransaction,
  subdomain: string,
  sectionIds: readonly string[],
  excludeEnrollmentIds: readonly string[] = [],
): Promise<Map<string, number>> {
  const ids = [...new Set(sectionIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const conditions = [
    eq(enrollments.workspaceSubdomain, subdomain),
    inArray(enrollments.sectionId, ids),
    isNull(enrollments.deletedAt),
    notInArray(enrollments.status, [...SEAT_RELEASED_ENROLLMENT_STATUSES]),
  ];
  const excluded = [...new Set(excludeEnrollmentIds.filter(Boolean))];
  if (excluded.length > 0) conditions.push(notInArray(enrollments.id, excluded));
  const rows = await tx
    .select({
      sectionId: enrollments.sectionId,
      count: sql<number>`count(*)::int`,
    })
    .from(enrollments)
    .where(and(...conditions))
    .groupBy(enrollments.sectionId);
  return new Map(rows.map((row) => [String(row.sectionId), Number(row.count)]));
}

export interface SeatAssertion {
  section: Pick<LockedSeatSection, "id" | "name" | "capacity">;
  /** Seats the write needs at once (default 1). */
  seats?: number;
  /** The enrollment's own row must not count against its target section. */
  excludeEnrollmentIds?: readonly string[];
}

/**
 * Refuses a write that would take more seats than the section has left.
 *
 * Must be called after {@link lockSectionsForSeatsTx} for the same transaction; the
 * count deliberately happens under the lock. A capacity of `0` means "unlimited" (the
 * same convention as `maxStudents` and `remainingSeats`), so the assertion is skipped.
 */
export async function assertSeatCapacityTx(
  tx: TenantTransaction,
  subdomain: string,
  assertion: SeatAssertion,
): Promise<void> {
  const seats = Math.max(1, assertion.seats ?? 1);
  const capacity = Math.max(0, assertion.section.capacity ?? 0);
  if (capacity === 0) return;
  const counts = await countLiveSeatsBySectionTx(
    tx,
    subdomain,
    [assertion.section.id],
    assertion.excludeEnrollmentIds ?? [],
  );
  const occupied = counts.get(assertion.section.id) ?? 0;
  const seatsLeft = Math.max(0, capacity - occupied);
  if (occupied + seats <= capacity) return;
  const label = assertion.section.name
    ? `${assertion.section.name} is full`
    : "The section is full";
  throw new SeatCapacityError(
    seatsLeft === 1 && seats === 1
      ? `${assertion.section.name || "The section"} has one seat left, which another enrollment is taking`
      : label,
    assertion.section.id,
    seatsLeft,
  );
}

export interface EnrollmentSeatHolder {
  id: string;
  sectionId: string | null;
  status: string;
  deleted: boolean;
}

/** Current placement/status of the enrollments a write is about to touch. */
export async function loadEnrollmentSeatHoldersTx(
  tx: TenantTransaction,
  subdomain: string,
  enrollmentIds: readonly string[],
): Promise<Map<string, EnrollmentSeatHolder>> {
  const ids = [...new Set(enrollmentIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const rows = await tx
    .select({
      id: enrollments.id,
      sectionId: enrollments.sectionId,
      status: enrollments.status,
      deletedAt: enrollments.deletedAt,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.workspaceSubdomain, subdomain),
        inArray(enrollments.id, ids),
        // Archived rows are hidden by FORCE RLS unless the caller opted in; this read
        // only needs live rows (a deleted enrollment holds no seat).
        isNull(enrollments.deletedAt),
      ),
    );
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        sectionId: row.sectionId,
        status: row.status,
        deleted: row.deletedAt !== null,
      },
    ]),
  );
}
