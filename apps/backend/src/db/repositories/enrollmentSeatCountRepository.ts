import { sql } from "drizzle-orm";
import { withTenant } from "../tenant-context.js";

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
