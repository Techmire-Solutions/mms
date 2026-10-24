import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema.js";
import { loadServerConfig } from "../config/serverConfig.js";
import { getRequestUserId } from "../lib/tenantContext.js";

type AppDb = NodePgDatabase<typeof schema>;

/**
 * SET LOCAL tenant RLS GUCs (+ statement/idle budgets when tenant-bound).
 * Consolidates configuration into a single parameterized SELECT set_config(...) query,
 * reducing socket round-trips from 5 to 1 per transaction.
 * Uses parameterized set_config(..., true) rather than raw DDL "SET LOCAL",
 * ensuring PostgreSQL cached prepared query plans are not invalidated.
 * Sets both `app.current_tenant` and `app.current_tenant_id` for backward and forward compatibility.
 * Null/empty subdomain enables `app.rls_bypass` and skips timeouts (migrations / admin).
 */
export async function applyTenantTransactionGuards(
  tx: AppDb,
  workspaceSubdomain: string | null | undefined,
  options?: { statementTimeoutMs?: number },
): Promise<void> {
  const userId = getRequestUserId() ?? "";

  if (workspaceSubdomain && workspaceSubdomain.trim()) {
    const tenant = workspaceSubdomain.trim().toLowerCase();
    const config = loadServerConfig();
    const statementTimeout = options?.statementTimeoutMs ?? config.pgStatementTimeoutMs;

    await tx.execute(
      sql`SELECT
        set_config('app.current_tenant', ${tenant}, true),
        set_config('app.current_tenant_id', ${tenant}, true),
        set_config('app.rls_bypass', 'off', true),
        set_config('statement_timeout', ${String(statementTimeout)}, true),
        set_config('idle_in_transaction_session_timeout', ${String(config.pgIdleInTxTimeoutMs)}, true),
        set_config('app.current_user_id', ${userId}, true)`,
    );
  } else {
    const config = loadServerConfig();
    const statementTimeout = options?.statementTimeoutMs ?? 60_000;
    await tx.execute(
      sql`SELECT
        set_config('app.rls_bypass', 'on', true),
        set_config('app.current_tenant', '', true),
        set_config('app.current_tenant_id', '', true),
        set_config('statement_timeout', ${String(statementTimeout)}, true),
        set_config('idle_in_transaction_session_timeout', ${String(config.pgIdleInTxTimeoutMs)}, true),
        set_config('app.current_user_id', ${userId}, true)`,
    );
  }
}
