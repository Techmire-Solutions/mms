import { enrollments } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { emitOutboxEvents } from "../../services/outboxEventService.js";

/**
 * Reads ids from an UPDATE ... RETURNING when the dialect/fake supports it. Production drizzle
 * always does; lightweight transaction fakes used by the data-layer specs return a thenable
 * without `.returning`, in which case no cascaded tombstones are emitted.
 */
export async function returningEnrollmentIds(query: unknown): Promise<string[]> {
  const maybe = query as {
    returning?: (selection: unknown) => Promise<Array<{ id: string }>>;
  } | null;
  if (!maybe || typeof maybe.returning !== "function") return [];
  const rows = await maybe.returning({ id: enrollments.id });
  return rows.map((row) => String(row.id));
}

interface CascadeEventInput {
  subdomain: string;
  action: "delete" | "restore";
  sessionIds: readonly string[];
  enrollmentIds: readonly string[];
  now: Date;
  actorId?: string;
  deletionReason?: string;
  /** Compact pre-images keyed by session id (captured before the soft-delete/restore update). */
  oldStates?: Record<string, unknown>;
}

/**
 * Appends the per-session audit rows and the session + cascaded-enrollment outbox tombstones
 * for one soft-delete/restore operation, inside the caller's transaction.
 */
export async function recordCascadeEvents(
  tx: TenantTransaction,
  input: CascadeEventInput,
): Promise<void> {
  const { subdomain, action, sessionIds, enrollmentIds, now, actorId, deletionReason, oldStates } =
    input;
  const time = now.toISOString();
  const version = now.getTime();

  for (const sessionId of sessionIds) {
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "sessions",
      recordId: sessionId,
      actionType: action === "delete" ? "DELETE" : "RESTORE",
      realUserId: actorId,
      oldState: oldStates?.[sessionId],
      newState:
        action === "delete"
          ? { deletedAt: time, deletionReason: deletionReason ?? null }
          : { restoredAt: time },
    });
  }

  if (action === "delete") {
    const cascadeReason = deletionReason
      ? `Cascade: parent session deleted (${deletionReason})`
      : "Cascade: parent session deleted";
    await emitOutboxEvents([
      ...sessionIds.map((sessionId) => ({
        type: "entity.soft_deleted" as const,
        payload: {
          entityType: "sessions",
          entityId: sessionId,
          tenantId: subdomain,
          deletedAt: time,
          deletedBy: actorId ?? "",
          deletionReason: deletionReason || undefined,
          version,
        },
      })),
      ...enrollmentIds.map((enrollmentId) => ({
        type: "entity.soft_deleted" as const,
        payload: {
          entityType: "enrollments",
          entityId: enrollmentId,
          tenantId: subdomain,
          deletedAt: time,
          deletedBy: actorId ?? "",
          deletionReason: cascadeReason,
          version,
        },
      })),
    ]);
    return;
  }

  await emitOutboxEvents([
    ...sessionIds.map((sessionId) => ({
      type: "entity.restored" as const,
      payload: {
        entityType: "sessions",
        entityId: sessionId,
        tenantId: subdomain,
        restoredAt: time,
        restoredBy: actorId ?? "",
        version,
      },
    })),
    ...enrollmentIds.map((enrollmentId) => ({
      type: "entity.restored" as const,
      payload: {
        entityType: "enrollments",
        entityId: enrollmentId,
        tenantId: subdomain,
        restoredAt: time,
        restoredBy: actorId ?? "",
        version,
      },
    })),
  ]);
}
