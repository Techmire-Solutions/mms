import { sql } from "drizzle-orm";
import { activeDb } from "../db/dbConnection.js";
import { logger } from "../lib/logger.js";

/**
 * Rolling provisioner for the `audit_trail_events` monthly range partitions.
 *
 * Why this exists
 * ---------------
 * `0102_modern_audit_trail.sql` creates only the first two monthly partitions
 * (2026-09, 2026-10) plus a DEFAULT partition. The default means writes never
 * hard-fail once those months pass — they silently pile into
 * `audit_trail_events_default` instead. That is worse than it looks:
 *
 *  - It defeats the retention story: `detach-audit-partition.ts` only knows
 *    `audit_trail_events_y<YYYY>m<MM>` names, so nothing can ever detach the
 *    accumulated rows.
 *  - It creates a trap for the next manual provision. Postgres refuses to
 *    attach a partition whose range already contains rows in the default
 *    partition ("updated partition constraint for default partition would be
 *    violated"), so provisioning must happen BEFORE the month starts.
 *
 * Provisioning ahead of time keeps the default partition empty so both the
 * detach workflow and future attaches keep working.
 */

/** How many months ahead of the current month to keep provisioned. */
const DEFAULT_MONTHS_AHEAD = 12;

export interface EnsureAuditPartitionsResult {
  created: string[];
  existing: string[];
}

/** `audit_trail_events_y2026m11` for 2026-11. */
export function auditPartitionName(year: number, month1to12: number): string {
  return `audit_trail_events_y${year}m${String(month1to12).padStart(2, "0")}`;
}

/** UTC month bounds as `YYYY-MM-DD HH:MM:SS+00` literals, matching 0102. */
function monthBounds(year: number, month1to12: number): { from: string; to: string } {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1));
  const end = new Date(Date.UTC(year, month1to12, 1));
  const fmt = (d: Date): string => d.toISOString().replace("T", " ").replace(".000Z", "+00");
  return { from: fmt(start), to: fmt(end) };
}

/**
 * Creates any missing monthly partitions from the current month through
 * `monthsAhead` months ahead. Idempotent — safe to run on every boot and on a
 * schedule.
 *
 * Runs as global (RLS-bypassed) work because it is DDL over a partitioned table
 * and touches no tenant rows.
 */
export async function ensureAuditTrailPartitions(options?: {
  monthsAhead?: number;
  now?: Date;
}): Promise<EnsureAuditPartitionsResult> {
  const monthsAhead = Math.max(options?.monthsAhead ?? DEFAULT_MONTHS_AHEAD, 1);
  const now = options?.now ?? new Date();
  const db = activeDb();

  const created: string[] = [];
  const existing: string[] = [];

  for (let offset = 0; offset < monthsAhead; offset += 1) {
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const name = auditPartitionName(year, month);
    const { from, to } = monthBounds(year, month);

    // `CREATE TABLE IF NOT EXISTS ... PARTITION OF` is a no-op when the
    // partition already exists, but we report which is which for observability.
    const present = await db.execute(
      sql`SELECT 1 FROM pg_class WHERE relname = ${name} AND relkind = 'r' LIMIT 1`,
    );
    const alreadyExists = (present.rows?.length ?? 0) > 0;

    if (alreadyExists) {
      existing.push(name);
      continue;
    }

    await db.execute(
      sql.raw(
        `CREATE TABLE IF NOT EXISTS "${name}" PARTITION OF "audit_trail_events" ` +
          `FOR VALUES FROM ('${from}') TO ('${to}')`,
      ),
    );
    created.push(name);
  }

  if (created.length > 0) {
    logger.info({ created, monthsAhead }, "Provisioned audit_trail_events monthly partitions");
  }

  return { created, existing };
}

/**
 * Reports whether the DEFAULT partition currently holds rows. A non-zero count
 * means monthly provisioning fell behind and retention can no longer detach
 * those rows by month.
 */
export async function countAuditDefaultPartitionRows(): Promise<number> {
  const db = activeDb();
  const result = await db.execute(
    sql`SELECT count(*)::int AS count FROM "audit_trail_events_default"`,
  );
  const row = result.rows?.[0] as { count?: number } | undefined;
  return Number(row?.count ?? 0);
}
