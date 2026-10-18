import { sql } from 'drizzle-orm';
import { loadBackendEnv } from '../config/loadEnv.js';
import { closeDatabase, initializeDatabaseConnection } from '../db/dbConnection.js';
import { withGlobalTenant } from '../db/tenant-context.js';
import { logger } from '../lib/logger.js';

loadBackendEnv();

/**
 * Read-only audit for Phase 6 (class / section reference integrity).
 *
 *   pnpm --filter mms-backend audit:class-references
 *
 * Counts rows whose class reference does not resolve to a `session_classes` row. Migration 0171
 * rewrites legacy attendance session-id references when the session has exactly one class, adds
 * every FK as NOT VALID (enforced for new writes) and validates only those with no orphans left.
 * Anything reported here keeps its FK unvalidated until an admin resolves it. Nothing is written.
 */
const CHECKS: ReadonlyArray<{ label: string; query: ReturnType<typeof sql> }> = [
  {
    label: 'session_classes duplicate (workspace, id) — needs admin (blocks migration 0171)',
    query: sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM session_classes GROUP BY workspace_subdomain, id HAVING count(*) > 1) d`,
  },
  ...['session_class_fees', 'session_class_schedules', 'session_class_budgets', 'session_class_discounts',
    'session_class_timetables', 'session_class_refreshments', 'session_class_scholarships'].map((table) => ({
    label: `${table}.session_class_id`,
    query: sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)} t
      WHERE NOT EXISTS (SELECT 1 FROM session_classes c WHERE c.workspace_subdomain = t.workspace_subdomain AND c.id = t.session_class_id)`,
  })),
  {
    label: 'session_class_timetable_periods.timetable_id',
    query: sql`SELECT count(*)::int AS n FROM session_class_timetable_periods p
      WHERE NOT EXISTS (SELECT 1 FROM session_class_timetables t WHERE t.workspace_subdomain = p.workspace_subdomain AND t.id = p.timetable_id)`,
  },
  {
    label: 'attendance.class_id (session id, single class — rewritable)',
    query: sql`SELECT count(*)::int AS n FROM attendance a
      WHERE NOT EXISTS (SELECT 1 FROM session_classes c WHERE c.workspace_subdomain = a.workspace_subdomain AND c.id = a.class_id)
        AND (SELECT count(*) FROM session_classes c WHERE c.workspace_subdomain = a.workspace_subdomain AND c.session_id = a.class_id) = 1`,
  },
  {
    label: 'attendance.class_id (unresolvable — needs admin)',
    query: sql`SELECT count(*)::int AS n FROM attendance a
      WHERE NOT EXISTS (SELECT 1 FROM session_classes c WHERE c.workspace_subdomain = a.workspace_subdomain AND c.id = a.class_id)
        AND (SELECT count(*) FROM session_classes c WHERE c.workspace_subdomain = a.workspace_subdomain AND c.session_id = a.class_id) <> 1`,
  },
  {
    label: 'exam_classes.class_id (unresolvable)',
    query: sql`SELECT count(*)::int AS n FROM exam_classes e
      WHERE NOT EXISTS (SELECT 1 FROM session_classes c WHERE c.workspace_subdomain = e.workspace_subdomain AND c.id = e.class_id)`,
  },
];

async function main(): Promise<void> {
  initializeDatabaseConnection();
  const results = await withGlobalTenant(async (tx) => {
    const rows: Array<{ label: string; count: number }> = [];
    for (const check of CHECKS) {
      const result = await tx.execute<{ n: number }>(check.query);
      rows.push({ label: check.label, count: Number(result.rows[0]?.n ?? 0) });
    }
    return rows;
  });
  for (const row of results) console.log(`  ${String(row.count).padStart(8)}  ${row.label}`);
  if (results.some((row) => row.label.includes('needs admin') && row.count > 0)) process.exitCode = 1;
  await closeDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, 'audit:class-references failed');
  process.exitCode = 1;
  await closeDatabase();
});
