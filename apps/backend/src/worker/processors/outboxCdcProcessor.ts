import { and, isNull, asc, eq, lt, sql } from "drizzle-orm";
import { withGlobalTenant } from "../../db/tenant-context.js";
import { outboxEvents } from "../../db/schema/outboxEvents.js";
import { redisGet, redisSet, redisDelPattern, redisKeys } from "../../lib/redis.js";
import { logger } from "../../lib/logger.js";
import type { SearchIndexAdapter } from "../adapters/searchIndexAdapter.js";

const BATCH_SIZE = 100;
/** After this many consecutive failures an event stops being retried (poison). */
const MAX_CDC_ATTEMPTS = 5;

/**
 * Redis key for tracking the last successfully processed version per entity.
 * Pattern: `mms:{tenantId}:search:version:{entityType}:{entityId}`
 */
function versionKey(tenantId: string, entityType: string, entityId: string): string {
  return redisKeys.searchVersion(tenantId, entityType, entityId);
}

/**
 * Redis cache eviction pattern for all entity-type keys in a tenant.
 * Evicts list pages, single-record caches, and KPI aggregates.
 */
function cacheEvictPattern(tenantId: string, entityType: string): string {
  return redisKeys.entityPattern(tenantId, entityType);
}

/**
 * Processes a bounded batch of unprocessed CDC outbox events.
 * Reads up to BATCH_SIZE rows, applies version guard, drives search index
 * mutations and Redis cache eviction, then marks each row processed.
 *
 * Idempotent: rows already marked `processed_at IS NOT NULL` are never
 * returned by the query (partial index).
 *
 * Runs inside a single transaction with `app.rls_bypass='on'`:
 *  - the transaction is what makes `FOR UPDATE SKIP LOCKED` meaningful — in
 *    autocommit the locks are released at statement end and two workers can
 *    claim the same rows;
 *  - the bypass is what lets a root-pool worker read every tenant's rows at all
 *    (the 0109 policy otherwise filters them all out).
 *
 * @param searchAdapter - Injectable search index adapter (real or stub).
 */
export async function processOutboxCdcBatch(
  searchAdapter: SearchIndexAdapter,
): Promise<{ processed: number; skipped: number }> {
  let processed = 0;
  let skipped = 0;

  await withGlobalTenant(async (db) => {
    // Select up to BATCH_SIZE unprocessed, non-poisoned events, locking rows so
    // concurrent workers cannot process the same event.
    const rows = await db
      .select({
        id: outboxEvents.id,
        workspaceSubdomain: outboxEvents.workspaceSubdomain,
        entityType: outboxEvents.entityType,
        entityId: outboxEvents.entityId,
        eventType: outboxEvents.eventType,
        payload: outboxEvents.payload,
      })
      .from(outboxEvents)
      .where(and(isNull(outboxEvents.processedAt), lt(outboxEvents.attempts, MAX_CDC_ATTEMPTS)))
      .orderBy(asc(outboxEvents.createdAt))
      .limit(BATCH_SIZE)
      .for("update", { skipLocked: true });

    if (rows.length === 0) return;

    for (const row of rows) {
      const payload = row.payload as Record<string, unknown>;
      const incomingVersion =
        typeof payload["version"] === "number" ? (payload["version"] as number) : 0;

      // Monotonic version guard — discard stale out-of-order events
      const vk = versionKey(row.workspaceSubdomain, row.entityType, row.entityId);
      const stored = await redisGet(vk);
      const existingVersion = stored !== null ? Number(stored) : 0;

      if (incomingVersion <= existingVersion) {
        logger.warn(
          {
            eventId: row.id,
            eventType: row.eventType,
            entityType: row.entityType,
            entityId: row.entityId,
            incomingVersion,
            existingVersion,
          },
          "[OutboxCdc] Dropping stale/out-of-order event — version guard",
        );
        // Mark processed so it is not retried (stale = permanently stale)
        await db
          .update(outboxEvents)
          .set({ processedAt: new Date() })
          .where(eq(outboxEvents.id, row.id));
        skipped += 1;
        continue;
      }

      try {
        if (row.eventType === "entity.soft_deleted") {
          // 1. Tombstone search index
          await searchAdapter.deleteDocument(row.entityType, row.entityId);
          // 2. Evict all tenant entity cache keys
          await redisDelPattern(cacheEvictPattern(row.workspaceSubdomain, row.entityType));
        } else if (row.eventType === "entity.restored") {
          // 1. Re-index document (snapshot payload used if available)
          await searchAdapter.indexDocument(row.entityType, row.entityId, payload);
          // 2. Evict stale cache entries so next read is fresh
          await redisDelPattern(cacheEvictPattern(row.workspaceSubdomain, row.entityType));
        } else {
          // entity.hard_purge or unknown — just evict cache
          await redisDelPattern(cacheEvictPattern(row.workspaceSubdomain, row.entityType));
        }

        // Advance the monotonic version tracker for this entity. TTL bounds
        // key growth; it only needs to outlive the version-comparison window.
        await redisSet(vk, String(incomingVersion), 30 * 24 * 60 * 60);

        // Mark the outbox row as processed
        await db
          .update(outboxEvents)
          .set({ processedAt: new Date() })
          .where(eq(outboxEvents.id, row.id));

        processed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(
          { err, eventId: row.id, eventType: row.eventType, entityId: row.entityId },
          "[OutboxCdc] Failed to process CDC event — incrementing attempt counter",
        );
        // Record the failure and move on. Once attempts reach MAX_CDC_ATTEMPTS
        // the event is excluded from the candidate query so it can no longer
        // head-of-line block newer events (it stays visible for inspection).
        await db
          .update(outboxEvents)
          .set({
            attempts: sql`${outboxEvents.attempts} + 1`,
            lastError: message,
          })
          .where(eq(outboxEvents.id, row.id));
      }
    }
  });

  return { processed, skipped };
}
