import {
  pgTable,
  text,
  timestamp,
  index,
  jsonb,
  bigint,
  varchar,
  integer,
} from "drizzle-orm/pg-core";
import { desc, sql } from "drizzle-orm";
import { workspaces } from "./platform.js";

/**
 * Transactional outbox table for CDC events emitted within the same DB
 * transaction as soft-delete / restore / hard-purge mutations.
 *
 * Downstream workers poll `WHERE processed_at IS NULL` and drive:
 *  - Meilisearch document tombstones / re-indexing
 *  - Redis key eviction for affected tenant caches
 *
 * Monotonic `version` (millisecond timestamp captured at emit time) lets
 * consumers reject out-of-order events from concurrent request races.
 */
export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity(),
    workspaceSubdomain: text("workspace_subdomain")
      .notNull()
      .references(() => workspaces.subdomain, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: varchar("entity_id", { length: 128 }).notNull(),
    /**
     * RFC 8785-compatible JSON payload. Shape varies by eventType:
     *
     * entity.soft_deleted: { entityType, entityId, tenantId, deletedAt,
     *   deletedBy, deletionReason?, version, snapshot? }
     * entity.restored:     { entityType, entityId, tenantId, restoredAt,
     *   restoredBy, version }
     * entity.hard_purge:   { entityType, entityId, tenantId, purgedAt, version }
     */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
    /** Consecutive processing failures — poison events stop being retried past the cap. */
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (table) => [
    // Primary key on identity column
    index("outbox_events_pk").on(table.id),
    // Hot path: polling for unprocessed events per tenant
    index("outbox_events_ws_unprocessed_idx")
      .on(table.workspaceSubdomain, table.createdAt)
      .where(sql`${table.processedAt} is null`),
    // General tenant + event type lookups
    index("outbox_events_ws_type_created_idx").on(
      table.workspaceSubdomain,
      table.eventType,
      desc(table.createdAt),
    ),
    // Entity-scoped lookups (e.g. replay, debug)
    index("outbox_events_ws_entity_idx").on(
      table.workspaceSubdomain,
      table.entityType,
      table.entityId,
    ),
  ],
);

export type OutboxEventRow = typeof outboxEvents.$inferSelect;
export type InsertOutboxEventRow = typeof outboxEvents.$inferInsert;
