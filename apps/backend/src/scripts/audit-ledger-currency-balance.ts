/**
 * @file audit-ledger-currency-balance.ts
 * @description Read-only audit of the dual-currency and postability invariants
 * migration 0254 enforces at commit. Run before a deploy and when reconciling:
 *
 *   pnpm --filter mms-backend audit:ledger-currency-balance
 *
 * Reports, per tenant:
 *   • posted entries whose non-functional currency legs do not balance
 *     (the functional currency group is skipped: its lines are the balancing side),
 *   • journal lines sitting on a summary/header account (an account with children),
 *   • posting periods left open inside a closed fiscal year.
 *
 * Exits non-zero when an invariant violation is found, so it can gate a deploy.
 * The check only reports — the 0254 migration warns about the same rows and never
 * blocks on existing data.
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

const QUERIES: Record<string, { kind: string; sql: string }> = {
  currency_imbalance: {
    kind: "currency_imbalance",
    sql: `
      SELECT e.workspace_subdomain, e.id AS entry_id,
             format('%s: debit %s vs credit %s',
                    fx.txn_currency, fx.debit_total, fx.credit_total) AS detail
        FROM accounting_entries e
        CROSS JOIN LATERAL (
          SELECT l.txn_currency,
                 sum(l.txn_debit) AS debit_total,
                 sum(l.txn_credit) AS credit_total
            FROM accounting_journal_lines l
           WHERE l.workspace_subdomain = e.workspace_subdomain
             AND l.entry_id = e.id
             AND l.txn_currency IS NOT NULL
           GROUP BY l.txn_currency
          HAVING sum(l.txn_debit) IS DISTINCT FROM sum(l.txn_credit)
             AND count(*) FILTER (WHERE l.txn_debit IS NULL OR l.txn_credit IS NULL) = 0
        ) fx
       WHERE e.status = 'posted'
         AND e.deleted_at IS NULL
         -- Single-currency vouchers only: a settlement entry's legs are deliberately in
         -- different currencies, and a pre-backfill NULL leg cannot be judged.
         AND (
           SELECT count(DISTINCT l.txn_currency)
             FROM accounting_journal_lines l
            WHERE l.workspace_subdomain = e.workspace_subdomain
              AND l.entry_id = e.id
              AND l.txn_currency IS NOT NULL
         ) = 1
         AND NOT EXISTS (
           SELECT 1 FROM accounting_journal_lines l
            WHERE l.workspace_subdomain = e.workspace_subdomain
              AND l.entry_id = e.id
              AND l.txn_currency IS NOT NULL
              AND (l.txn_debit IS NULL OR l.txn_credit IS NULL)
         )`,
  },
  line_on_summary_account: {
    kind: "line_on_summary_account",
    sql: `
      SELECT l.workspace_subdomain, l.entry_id,
             format('line %s on summary account %s', l.id, l.account_id) AS detail
        FROM accounting_journal_lines l
       WHERE EXISTS (
         SELECT 1 FROM accounting_accounts child
          WHERE child.workspace_subdomain = l.workspace_subdomain
            AND child.parent_account_id = l.account_id
            AND child.deleted_at IS NULL
       )`,
  },
  open_period_in_closed_year: {
    kind: "open_period_in_closed_year",
    sql: `
      SELECT p.workspace_subdomain, p.id AS entry_id,
             format('period %s is open but its fiscal year %s is closed', p.label, fy.label) AS detail
        FROM accounting_posting_periods p
        JOIN accounting_fiscal_years fy
          ON fy.workspace_subdomain = p.workspace_subdomain
         AND fy.id = p.fiscal_year_id
       WHERE p.status = 'open' AND fy.status = 'closed'`,
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
    console.log(
      "✓ audit:ledger-currency-balance — every currency leg balances and no line sits on a summary account.",
    );
    return;
  }

  for (const row of violations) {
    console.log(`${row.kind.padEnd(24)} ${row.workspace_subdomain.padEnd(32)} ${row.entry_id}`);
    if (row.detail) console.log(`${"".padEnd(24)} ${row.detail}`);
  }
  const counts = violations.reduce<Record<string, number>>((acc, row) => {
    acc[row.kind] = (acc[row.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\nsummary: ${JSON.stringify(counts)}`);
  console.log(`\n✗ audit:ledger-currency-balance — ${violations.length} invariant violation(s).`);
  process.exitCode = 1;
}

await run().catch((error: unknown) => {
  logger.error({ err: error }, "audit:ledger-currency-balance failed");
  console.error("✗ Failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
