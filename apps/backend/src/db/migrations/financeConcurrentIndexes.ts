/**
 * @file financeConcurrentIndexes.ts
 * @description Provision the Finance module's directory indexes that cannot live in a migration.
 *
 * `finance_invoices` and `finance_payments` are in the migration-index ratchet's large-table list
 * (`scripts/check-migration-indexes.mjs`), so a plain `CREATE INDEX` in a migration is a write
 * outage on a populated database. `CREATE INDEX CONCURRENTLY` cannot be expressed there either:
 * Drizzle's migrator wraps a migration run in a single transaction and PostgreSQL rejects
 * `CONCURRENTLY` inside one.
 *
 * The indexes themselves are ordinary directory support:
 *   • `created_at DESC, id` — the default ordering of both Work directories
 *     (`buildInvoiceOrderBy` / `buildPaymentOrderBy`); without it every page request sorts the
 *     tenant, because the existing `date`/`status` indexes cannot serve that ORDER BY.
 *   • `student_id, billing_period` — the generated-invoice uniqueness/lookup path. It already
 *     existed on operated databases but was recorded in no migration, so a fresh database never
 *     got it. Recorded here so provisioned and fresh environments converge.
 *
 * Runs once per boot, right after the Drizzle migrate step, on a disposable `pg.Client` (never
 * inside a transaction), idempotently: a failed concurrent build leaves an invalid index which is
 * dropped and rebuilt.
 */
import type pg from "pg";
import { logger } from "../../lib/logger.js";

/** Serializes the step across replicas (2145836401-407 are taken by other boot steps). */
const FINANCE_INDEX_LOCK_KEY = 2145836408;

type IndexState = "missing" | "valid" | "invalid";

interface ConcurrentIndexSpec {
  name: string;
  createSql: string;
}

export const FINANCE_CONCURRENT_INDEXES: readonly ConcurrentIndexSpec[] = [
  {
    name: "finance_invoices_workspace_created_active_idx",
    createSql: `
      CREATE INDEX CONCURRENTLY "finance_invoices_workspace_created_active_idx"
        ON public."finance_invoices" ("workspace_subdomain", "created_at" DESC, "id")
        WHERE "deleted_at" IS NULL`,
  },
  {
    name: "finance_payments_workspace_created_active_idx",
    createSql: `
      CREATE INDEX CONCURRENTLY "finance_payments_workspace_created_active_idx"
        ON public."finance_payments" ("workspace_subdomain", "created_at" DESC, "id")
        WHERE "deleted_at" IS NULL`,
  },
  {
    // Pre-existing on operated databases (never migrated); declared here for fresh ones.
    name: "finance_invoices_workspace_student_period_active_idx",
    createSql: `
      CREATE INDEX CONCURRENTLY "finance_invoices_workspace_student_period_active_idx"
        ON public."finance_invoices" ("workspace_subdomain", "student_id", "billing_period")
        WHERE "deleted_at" IS NULL`,
  },
];

async function indexState(client: pg.Client, indexName: string): Promise<IndexState> {
  const existing = await client.query<{ indisvalid: boolean }>(
    `SELECT i.indisvalid FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1`,
    [indexName],
  );
  if (existing.rowCount === 0) return "missing";
  return existing.rows[0]?.indisvalid ? "valid" : "invalid";
}

/**
 * Creates the finance directory indexes if missing. Non-fatal: a failure is logged and the
 * application keeps serving (queries fall back to the previous plans) rather than refusing to boot.
 */
export async function ensureFinanceConcurrentIndexes(client: pg.Client): Promise<void> {
  try {
    await client.query("SELECT pg_advisory_lock($1)", [FINANCE_INDEX_LOCK_KEY]);
  } catch (error) {
    logger.warn({ err: error }, "Finance index lock unavailable; skipping");
    return;
  }
  try {
    const created: string[] = [];
    for (const spec of FINANCE_CONCURRENT_INDEXES) {
      const state = await indexState(client, spec.name);
      if (state === "valid") continue;
      if (state === "invalid") {
        // A failed CONCURRENTLY build leaves an index the planner ignores.
        await client.query(`DROP INDEX CONCURRENTLY IF EXISTS public."${spec.name}"`);
      }
      await client.query(spec.createSql);
      created.push(spec.name);
    }
    if (created.length > 0) {
      logger.info({ indexes: created }, "Provisioned finance directory indexes");
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to provision finance directory indexes");
  } finally {
    await client
      .query("SELECT pg_advisory_unlock($1)", [FINANCE_INDEX_LOCK_KEY])
      .catch(() => undefined);
  }
}
