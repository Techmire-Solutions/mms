/**
 * @file audit-ledger-balance.ts
 * @description Read-only audit of the ledger-control invariants migration 0249
 * enforces at commit. Run before/after a deploy and when reconciling:
 *
 *   pnpm --filter mms-backend audit:ledger-balance
 *
 * Reports, per tenant:
 *   • posted entries that are unbalanced or have fewer than two lines,
 *   • posted entries whose functional amounts do not mirror the ledger amounts,
 *   • posted entries dated inside a closed posting period,
 *   • live invoices/payments with no ledger posting (posting rules configured
 *     after the document was created — nothing backfills them, see F11 in
 *     docs/finance-ledger-controls-audit-2026-11-12.md).
 *
 * Exits non-zero when an invariant violation is found, so it can gate a deploy.
 * Missing ledger postings are reported but do not fail the run: they are a
 * historical data gap, not a broken invariant.
 */
import { sql } from "drizzle-orm";
import { closeDatabase, initializeDatabaseConnection } from "../db/dbConnection.js";
import { withGlobalTenant } from "../db/tenant-context.js";
import { loadBackendEnv } from "../config/loadEnv.js";
import { logger } from "../lib/logger.js";

loadBackendEnv();

interface ViolationRow {
  workspace_subdomain: string;
  entry_id: string;
  kind: string;
  detail: string;
}

const QUERIES: Record<string, { kind: string; sql: string; failing: boolean }> = {
  unbalanced: {
    kind: "unbalanced",
    failing: true,
    sql: `
      SELECT e.workspace_subdomain, e.id AS entry_id,
             format('%s debit vs %s credit across %s line(s)',
                    coalesce(sum(l.debit), 0), coalesce(sum(l.credit), 0), count(l.id)) AS detail
        FROM accounting_entries e
        LEFT JOIN accounting_journal_lines l
          ON l.workspace_subdomain = e.workspace_subdomain AND l.entry_id = e.id
       WHERE e.status = 'posted'
         AND e.deleted_at IS NULL
       GROUP BY e.workspace_subdomain, e.id
      HAVING count(l.id) < 2
          OR coalesce(sum(l.debit), 0) <> coalesce(sum(l.credit), 0)
          OR coalesce(sum(l.debit), 0) <= 0`,
  },
  functional_mismatch: {
    kind: "functional_mismatch",
    failing: true,
    sql: `
      SELECT l.workspace_subdomain, l.entry_id,
             format('line %s func %s/%s vs ledger %s/%s',
                    l.id, l.func_debit, l.func_credit, l.debit, l.credit) AS detail
        FROM accounting_journal_lines l
        JOIN accounting_entries e
          ON e.workspace_subdomain = l.workspace_subdomain AND e.id = l.entry_id
       WHERE e.status = 'posted'
         AND e.deleted_at IS NULL
         AND (
           (l.func_debit IS NOT NULL AND l.func_debit <> l.debit)
           OR (l.func_credit IS NOT NULL AND l.func_credit <> l.credit)
         )`,
  },
  closed_period: {
    kind: "closed_period",
    failing: true,
    sql: `
      SELECT e.workspace_subdomain, e.id AS entry_id,
             format('dated %s inside closed period %s', e.date, p.label) AS detail
        FROM accounting_entries e
        JOIN accounting_posting_periods p
          ON p.workspace_subdomain = e.workspace_subdomain
         AND p.status = 'closed'
         AND e.date BETWEEN p.start_date AND p.end_date
       WHERE e.status = 'posted'
         AND e.deleted_at IS NULL`,
  },
  unposted_documents: {
    kind: "unposted_documents",
    failing: false,
    sql: `
      SELECT i.workspace_subdomain, i.id AS entry_id,
             format('invoice %s has no %s posting', i.id, 'invoice') AS detail
        FROM finance_invoices i
       WHERE i.deleted_at IS NULL
         AND i.status NOT IN ('cancelled')
         AND NOT EXISTS (
           SELECT 1 FROM accounting_entries e
            WHERE e.workspace_subdomain = i.workspace_subdomain
              AND e.source_type = 'invoice' AND e.source_id = i.id
         )
       UNION ALL
      SELECT p.workspace_subdomain, p.id,
             format('payment %s has no payment posting', p.id)
        FROM finance_payments p
       WHERE p.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM accounting_entries e
            WHERE e.workspace_subdomain = p.workspace_subdomain
              AND e.source_type = 'payment' AND e.source_id = p.id
         )`,
  },
};

async function run(): Promise<void> {
  const violations: ViolationRow[] = [];
  try {
    initializeDatabaseConnection();
    const rows = await withGlobalTenant(
      async (tx) => {
        const found: ViolationRow[] = [];
        for (const spec of Object.values(QUERIES)) {
          const result = await tx.execute(sql.raw(spec.sql));
          for (const row of result.rows as Array<Record<string, string>>) {
            found.push({
              workspace_subdomain: row.workspace_subdomain ?? "",
              entry_id: row.entry_id ?? "",
              kind: spec.kind,
              detail: row.detail ?? "",
            });
          }
        }
        return found;
      },
      { statementTimeoutMs: 120_000 },
    );
    violations.push(...rows);
  } finally {
    await closeDatabase().catch(() => undefined);
  }

  if (violations.length === 0) {
    console.log("✓ audit:ledger-balance — every posted entry satisfies the ledger invariants.");
    return;
  }

  for (const row of violations) {
    console.log(`${row.kind.padEnd(20)} ${row.workspace_subdomain.padEnd(32)} ${row.entry_id}`);
    if (row.detail) console.log(`${"".padEnd(20)} ${row.detail}`);
  }
  const failing = violations.filter((row) => QUERIES[row.kind]?.failing);
  const counts = violations.reduce<Record<string, number>>((acc, row) => {
    acc[row.kind] = (acc[row.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\nsummary: ${JSON.stringify(counts)}`);
  if (failing.length > 0) {
    console.log(`\n✗ audit:ledger-balance — ${failing.length} ledger invariant violation(s).`);
    process.exitCode = 1;
  } else {
    console.log(
      "\n✓ ledger invariants hold; unposted documents listed above are historical data gaps.",
    );
  }
}

await run().catch((error: unknown) => {
  logger.error({ err: error }, "audit:ledger-balance failed");
  console.error("✗ Failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
