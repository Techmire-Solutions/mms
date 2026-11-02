import { sql } from "drizzle-orm";
import type { AppDb } from "../db/tenant-context.js";
import { activeDb } from "../db/dbConnection.js";
import { outboxEvents } from "../db/schema/outboxEvents.js";

// ---------------------------------------------------------------------------
// Public event-type discriminated union
// ---------------------------------------------------------------------------

export type OutboxEventType =
  | "entity.soft_deleted"
  | "entity.restored"
  | "entity.hard_purge"
  | "task.assigned"
  | "task.status_changed";

export type SoftDeletedPayload = {
  entityType: string;
  entityId: string;
  tenantId: string;
  /** ISO-8601 timestamp of the deletion action. */
  deletedAt: string;
  /** User ID of the actor who performed the delete. */
  deletedBy: string;
  deletionReason?: string;
  /**
   * Monotonic millisecond version stamp (Date.now() at emit time).
   * Consumers MUST discard events where version <= their last-seen version
   * for this entity to prevent out-of-order delivery race conditions.
   */
  version: number;
  /**
   * Forensic text snapshot of user-authored content captured immediately
   * before archival.  Survives the retention hard-purge window so the
   * textual record is preserved in the audit trail even after physical
   * row deletion.
   */
  snapshot?: Record<string, unknown>;
};

export type RestoredPayload = {
  entityType: string;
  entityId: string;
  tenantId: string;
  restoredAt: string;
  restoredBy: string;
  version: number;
};

export type HardPurgePayload = {
  entityType: string;
  entityId: string;
  tenantId: string;
  purgedAt: string;
  version: number;
};

/** Messaging/outbox intent for task assignee or status notifications. */
export type TaskNotifyPayload = {
  entityType: "tasks";
  entityId: string;
  tenantId: string;
  version: number;
  recipientUserIds: string[];
  actorUserId?: string;
  reason: "assignment" | "status_change";
  status?: string;
  title?: string;
};

export type OutboxPayload =
  SoftDeletedPayload | RestoredPayload | HardPurgePayload | TaskNotifyPayload;

// ---------------------------------------------------------------------------
// Core emit function — MUST be called inside an existing transaction
// ---------------------------------------------------------------------------

/**
 * Writes a CDC outbox event record **inside the provided transaction**.
 * Mirrors the dual-overload of `recordModernAuditEvent`:
 *  - With explicit tx: `emitOutboxEvent(tx, type, payload)`
 *  - Without tx:       `emitOutboxEvent(type, payload)` → falls back to activeDb()
 *    which resolves to the AsyncLocalStorage-propagated transaction when inside
 *    a `runInTransaction` / `withTenant` callback.
 */
export async function emitOutboxEvent(
  eventType: OutboxEventType,
  payload: OutboxPayload,
): Promise<void>;
export async function emitOutboxEvent(
  tx: AppDb,
  eventType: OutboxEventType,
  payload: OutboxPayload,
): Promise<void>;
export async function emitOutboxEvent(
  first: AppDb | OutboxEventType,
  second: OutboxEventType | OutboxPayload,
  third?: OutboxPayload,
): Promise<void> {
  const isExplicitTx = third !== undefined;
  const eventType = isExplicitTx ? (second as OutboxEventType) : (first as OutboxEventType);
  const payload = isExplicitTx ? third : (second as OutboxPayload);

  const row = {
    workspaceSubdomain: payload.tenantId,
    eventType,
    entityType: payload.entityType,
    entityId: payload.entityId,
    payload,
  };

  if (isExplicitTx) {
    const tx = first as AppDb;
    await tx.insert(outboxEvents).values(row);
    if ("execute" in tx && typeof tx.execute === "function") {
      try {
        await tx.execute(sql`NOTIFY mms_outbox_events, 'new_event'`);
      } catch {
        // Non-blocking fallback if NOTIFY is unsupported in testing or mock transactions
      }
    }
  } else {
    const db = activeDb();
    await db.insert(outboxEvents).values(row);
    try {
      await db.execute(sql`NOTIFY mms_outbox_events, 'new_event'`);
    } catch {
      // Non-blocking fallback if NOTIFY is unsupported in testing or mock transactions
    }
  }
}

export interface OutboxBatchEvent {
  type: OutboxEventType;
  payload: OutboxPayload;
}

/**
 * Batched variant of {@link emitOutboxEvent}: one multi-row INSERT and one
 * `NOTIFY` for the whole batch instead of a round trip per row.
 *
 * Bulk module operations (e.g. contact soft-delete/restore) previously emitted
 * one insert **plus** one NOTIFY per row while holding the write transaction.
 * Audit rows deliberately stay per-row: `recordModernAuditEvent` appends to a
 * sharded hash chain, so batching it would break the chain.
 */
export async function emitOutboxEvents(events: readonly OutboxBatchEvent[]): Promise<void> {
  if (events.length === 0) return;
  const rows = events.map(({ type, payload }) => ({
    workspaceSubdomain: payload.tenantId,
    eventType: type,
    entityType: payload.entityType,
    entityId: payload.entityId,
    payload,
  }));

  const db = activeDb();
  await db.insert(outboxEvents).values(rows);
  try {
    await db.execute(sql`NOTIFY mms_outbox_events, 'new_event'`);
  } catch {
    // Non-blocking fallback if NOTIFY is unsupported in testing or mock transactions
  }
}
