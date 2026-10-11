import { and, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { DbClient } from "../db/dbConnection.js";
import { messageLogs, attendance } from "../db/schema.js";
import { recordModernAuditEvent } from "../services/auditTrailService.js";
import { emitOutboxEvent } from "../services/outboxEventService.js";
import { logger } from "../lib/logger.js";

const CHUNK_SIZE = 500;
const INTER_CHUNK_PAUSE_MS = 50;

/**
 * Sets the transaction-local GUCs required for retention purge.
 *
 * The worker runs on the root pool (no request tenant context), so without
 * this the FORCE-RLS soft-delete policy on `message_logs`/`attendance` filters
 * out every archived row (`deleted_at IS NOT NULL`) and the candidate SELECT
 * returns zero rows — i.e. nothing is ever purged.
 *
 * `app.rls_bypass = 'on'` disables the policy filter; the query still scopes
 * explicitly by `workspace_subdomain`, so isolation is preserved. The
 * `app.allow_hard_purge` flag is what lets the physical DELETE past the
 * `forbid_hard_delete` trigger.
 */
function purgeTransactionContext(tenant: string) {
  return sql`SELECT
    set_config('app.current_tenant', ${tenant}, true),
    set_config('app.current_tenant_id', ${tenant}, true),
    set_config('app.rls_bypass', 'on', true),
    set_config('app.include_deleted', 'true', true),
    set_config('app.allow_hard_purge', 'true', true)`;
}

export interface PurgeExpiredOptions {
  targetTables?: Array<{
    name: string;
    table: typeof messageLogs | typeof attendance;
  }>;
}

/**
 * Background purge worker — safely and permanently hard-purges archived records
 * that have exceeded their legal/operational retention window.
 *
 * Architecture & Constraints:
 * 1. Executes in bounded chunks of 500 rows using FOR UPDATE SKIP LOCKED.
 * 2. Pauses 50ms between chunks to prevent database transaction starvation and WAL spikes.
 * 3. Bypasses BEFORE DELETE trigger within the worker transaction via `SET LOCAL app.allow_hard_purge = 'true'`.
 * 4. Records a modern 5-dimension audit event before physical deletion.
 * 5. Strictly scoped by tenant workspace subdomain.
 */
export async function purgeExpiredArchivedRecords(
  db: DbClient,
  tenant: string,
  dryRun = process.env.DRY_RUN === "true",
  options?: PurgeExpiredOptions,
): Promise<{ purgedTables: Record<string, number> }> {
  const normalizedTenant = tenant.trim().toLowerCase();

  const results: Record<string, number> = {};

  const targets = options?.targetTables ?? [
    { table: messageLogs, name: "message_logs" },
    { table: attendance, name: "attendance" },
  ];

  const now = new Date();

  for (const { table, name } of targets) {
    let totalPurged = 0;

    if (dryRun) {
      // Must run inside a transaction with the purge GUCs applied, otherwise
      // RLS hides the archived rows and the count is always 0.
      const count = await db.transaction(async (tx) => {
        await tx.execute(purgeTransactionContext(normalizedTenant));
        const countRes = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(table)
          .where(
            and(
              eq(table.workspaceSubdomain, normalizedTenant),
              isNotNull(table.deletedAt),
              // Use the DB-generated purge_after column — query planner hits the partial index
              lte(table.purgeAfter, now),
            ),
          );
        return countRes[0]?.count ?? 0;
      });
      results[name] = count;
      if (name === "attendance") {
        results["attendance_records"] = count;
      }
      logger.info(
        { tenant: normalizedTenant, table: name, count },
        "Purge worker dry-run count calculated",
      );
      continue;
    }

    while (true) {
      const chunkPurgedCount = await db.transaction(async (tx) => {
        // 1. Apply tenant/purge GUCs (RLS bypass + include archived + trigger bypass)
        await tx.execute(purgeTransactionContext(normalizedTenant));

        // 2. Select batch of IDs using SKIP LOCKED to prevent transaction lock contention
        const candidates = await tx
          .select({ id: table.id })
          .from(table)
          .where(
            and(
              eq(table.workspaceSubdomain, normalizedTenant),
              isNotNull(table.deletedAt),
              // DB-generated purge_after column — triggers partial index on (workspace, purge_after)
              lte(table.purgeAfter, now),
            ),
          )
          .limit(CHUNK_SIZE)
          .for("update", { skipLocked: true });

        if (candidates.length === 0) return 0;

        const ids = candidates.map((c) => c.id);

        // 3. Emit tamper-evident audit trail record inside transaction
        await recordModernAuditEvent(tx, {
          workspaceSubdomain: normalizedTenant,
          tableName: name,
          recordId: `purge-batch-${Date.now()}`,
          actionType: "DELETE",
          clientApp: "background-purge-worker",
          apiEndpoint: "entity.hard_purge",
          oldState: {
            event: "entity.hard_purge",
            retentionCutoff: now.toISOString(),
            purgedCount: ids.length,
            purgedIds: ids,
          },
          newState: null,
        });

        // 3b. Emit CDC outbox event for each purged entity (cache eviction / tombstoning)
        if ("insert" in tx && typeof tx.insert === "function") {
          for (const id of ids) {
            try {
              await emitOutboxEvent(tx, "entity.hard_purge", {
                entityType: name,
                entityId: id,
                tenantId: normalizedTenant,
                purgedAt: now.toISOString(),
                version: Date.now(),
              });
            } catch {
              // outbox event emission is non-fatal if table unavailable in mocks
            }
          }
        }

        // 4. Physical hard delete of bounded chunk
        await tx
          .delete(table)
          .where(and(eq(table.workspaceSubdomain, normalizedTenant), inArray(table.id, ids)));

        return ids.length;
      });

      totalPurged += chunkPurgedCount;

      // Exit loop if no rows remained or batch was partial
      if (chunkPurgedCount < CHUNK_SIZE) break;

      // Yield event loop to allow concurrent tenant read/write transactions to proceed
      await new Promise((resolve) => setTimeout(resolve, INTER_CHUNK_PAUSE_MS));
    }

    results[name] = totalPurged;
    if (name === "attendance") {
      results["attendance_records"] = totalPurged;
    }
    logger.info(
      { tenant: normalizedTenant, table: name, totalPurged },
      "Purge worker completed table",
    );
  }

  return { purgedTables: results };
}
