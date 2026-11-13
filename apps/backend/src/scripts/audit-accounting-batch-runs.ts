/**
 * @file audit-accounting-batch-runs.ts
 * @description Read-only audit of automated accounting batch runs (FX revaluation,
 * IAS 29 restatement). Run before a deploy and after the worker hardening:
 *
 *   pnpm --filter mms-backend exec tsx src/scripts/audit-accounting-batch-runs.ts
 *
 * Reports runs whose posted pair is incomplete:
 *   • the run row has revaluation lines but no entry / no reversal entry,
 *   • the referenced entry (or its reversal) no longer exists or was soft-deleted.
 *
 * Why these states can exist: the month-end sweep used to call the posting use case
 * outside a tenant transaction, so a crash between the two generated entries (or
 * before the run row was saved) could commit a partial pair. The sweep now posts in
 * one transaction (see docs/accounting-background-workers-audit-2026-11-13.md), so
 * new partial runs cannot be created — this script finds the historical ones.
 *
 * It only reports: recomputing a partial post is ambiguous (the retranslation delta
 * measured after a half-applied run is usually zero), so the repair is a deliberate
 * operator decision (reverse the stray entry, then re-run the date).
 *
 * Exits non-zero when a partial run is found, so it can gate a deploy.
 */
import { sql } from "drizzle-orm";
import { closeDatabase, initializeDatabaseConnection } from "../db/dbConnection.js";
import { withGlobalTenant } from "../db/tenant-context.js";
import { loadBackendEnv } from "../config/loadEnv.js";
import { logger } from "../lib/logger.js";

loadBackendEnv();

interface ViolationRow {
  workspace_subdomain: string;
  run_id: string;
  kind: string;
  detail: string;
}

const QUERIES: Record<string, string> = {
  fx_partial_pair: `
    SELECT r.workspace_subdomain, r.id AS run_id,
           format('date %s entry=%s reversal=%s lines=%s',
                  r.revaluation_date,
                  coalesce(r.entry_id, 'null'),
                  coalesce(r.reversal_entry_id, 'null'),
                  (SELECT count(*) FROM accounting_fx_revaluation_lines l
                    WHERE l.workspace_subdomain = r.workspace_subdomain
                      AND l.run_id = r.id)) AS detail
      FROM accounting_fx_revaluation_runs r
     WHERE (r.entry_id IS NULL OR r.reversal_entry_id IS NULL)
       AND EXISTS (SELECT 1 FROM accounting_fx_revaluation_lines l
                    WHERE l.workspace_subdomain = r.workspace_subdomain
                      AND l.run_id = r.id)`,
  fx_missing_entry: `
    SELECT r.workspace_subdomain, r.id AS run_id,
           format('date %s entry %s missing or deleted', r.revaluation_date, r.entry_id) AS detail
      FROM accounting_fx_revaluation_runs r
     WHERE r.entry_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM accounting_entries e
                        WHERE e.workspace_subdomain = r.workspace_subdomain
                          AND e.id = r.entry_id
                          AND e.deleted_at IS NULL)`,
  fx_missing_reversal: `
    SELECT r.workspace_subdomain, r.id AS run_id,
           format('date %s reversal %s missing or deleted',
                  r.revaluation_date, r.reversal_entry_id) AS detail
      FROM accounting_fx_revaluation_runs r
     WHERE r.reversal_entry_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM accounting_entries e
                        WHERE e.workspace_subdomain = r.workspace_subdomain
                          AND e.id = r.reversal_entry_id
                          AND e.deleted_at IS NULL)`,
  ias29_partial_pair: `
    SELECT r.workspace_subdomain, r.id AS run_id,
           format('date %s entry=%s reversal=%s', r.restatement_date,
                  coalesce(r.entry_id, 'null'),
                  coalesce(r.reversal_entry_id, 'null')) AS detail
      FROM accounting_ias29_runs r
     WHERE r.entry_id IS NULL OR r.reversal_entry_id IS NULL`,
  ias29_missing_entry: `
    SELECT r.workspace_subdomain, r.id AS run_id,
           format('date %s entry %s missing or deleted', r.restatement_date, r.entry_id) AS detail
      FROM accounting_ias29_runs r
     WHERE r.entry_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM accounting_entries e
                        WHERE e.workspace_subdomain = r.workspace_subdomain
                          AND e.id = r.entry_id
                          AND e.deleted_at IS NULL)`,
};

async function run(): Promise<void> {
  const violations: ViolationRow[] = [];
  try {
    initializeDatabaseConnection();
    const found = await withGlobalTenant(
      async (tx) => {
        const rows: ViolationRow[] = [];
        for (const [kind, query] of Object.entries(QUERIES)) {
          const result = await tx.execute(sql.raw(query));
          for (const row of result.rows as Array<Record<string, string>>) {
            rows.push({
              workspace_subdomain: row.workspace_subdomain ?? "",
              run_id: row.run_id ?? "",
              kind,
              detail: row.detail ?? "",
            });
          }
        }
        return rows;
      },
      { statementTimeoutMs: 120_000 },
    );
    violations.push(...found);
  } finally {
    await closeDatabase().catch(() => undefined);
  }

  if (violations.length === 0) {
    console.log(
      "✓ audit:accounting-batch-runs — every revaluation/IAS 29 run has its full posted pair.",
    );
    return;
  }

  for (const row of violations) {
    console.log(`${row.kind.padEnd(22)} ${row.workspace_subdomain.padEnd(32)} ${row.run_id}`);
    if (row.detail) console.log(`${"".padEnd(22)} ${row.detail}`);
  }
  const counts = violations.reduce<Record<string, number>>((acc, row) => {
    acc[row.kind] = (acc[row.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\nsummary: ${JSON.stringify(counts)}`);
  console.log(`\n✗ audit:accounting-batch-runs — ${violations.length} partial run(s).`);
  process.exitCode = 1;
}

await run().catch((error: unknown) => {
  logger.error({ err: error }, "audit:accounting-batch-runs failed");
  console.error("✗ Failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
