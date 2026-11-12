import { and, eq, getTableColumns, inArray, isNotNull, isNull } from "drizzle-orm";
import { dedupeTrimmedIds } from "@mms/shared";
import { workshopEvents } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { emitOutboxEvents } from "../../services/outboxEventService.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

/**
 * Trash lifecycle for workshops (soft-delete §2.2 / §2.5 / invariant 7).
 *
 * Both directions take the event row `FOR UPDATE` before touching it. Registrations, capacity
 * edits, check-ins and scores take the same lock, so an archive cannot interleave with a write
 * that already read the row as active — either the child write commits first, or it re-reads an
 * archived row and fails (`soft-delete.md` §4.6, parent-deletion vs child-insertion race).
 *
 * The outbox CDC event and the audit row are written in the same transaction as the UPDATE:
 * downstream search/cache consumers only learn about the archive through the outbox, and the audit
 * hash chain must not describe a state the database refused to store.
 */

type WorkshopRow = typeof workshopEvents.$inferSelect;

function forensicSnapshot(row: WorkshopRow): Record<string, unknown> {
  return {
    title: row.title,
    startDate: row.startDate,
    endDate: row.endDate,
    registrationDeadline: row.registrationDeadline,
    capacity: row.capacity,
    fee: row.fee,
  };
}

export async function softDeleteWorkshops(
  tenant: string,
  ids: string[],
  deletedBy: string | null,
  deletionReason: string | null,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };

  return withTenant(subdomain, async (tx) => {
    const now = new Date();
    const targets = await tx
      .select(getTableColumns(workshopEvents))
      .from(workshopEvents)
      .where(
        and(
          eq(workshopEvents.workspaceSubdomain, subdomain),
          inArray(workshopEvents.id, uniqueIds),
          isNull(workshopEvents.deletedAt),
        ),
      )
      .for("update");

    if (targets.length === 0) {
      return { succeeded: 0, failed: uniqueIds.length };
    }

    const targetIds = targets.map((row) => row.id);
    const updated = await tx
      .update(workshopEvents)
      .set({ deletedAt: now, deletedBy, deletionReason, updatedAt: now })
      .where(
        and(
          eq(workshopEvents.workspaceSubdomain, subdomain),
          inArray(workshopEvents.id, targetIds),
          isNull(workshopEvents.deletedAt),
        ),
      )
      .returning({ id: workshopEvents.id });

    const archived = targets.filter((row) => updated.some((saved) => saved.id === row.id));
    if (archived.length > 0) {
      await emitOutboxEvents(
        archived.map((row) => ({
          type: "entity.soft_deleted" as const,
          payload: {
            entityType: "workshop_events",
            entityId: row.id,
            tenantId: subdomain,
            deletedAt: now.toISOString(),
            deletedBy: deletedBy ?? "system",
            deletionReason: deletionReason ?? undefined,
            version: now.getTime(),
            snapshot: forensicSnapshot(row),
          },
        })),
      );
      for (const row of archived) {
        await recordModernAuditEvent({
          workspaceSubdomain: subdomain,
          tableName: "workshop_events",
          recordId: row.id,
          actionType: "DELETE",
          subjectId: row.id,
          oldState: row,
          newState: {
            ...row,
            deletedAt: now,
            deletedBy,
            deletionReason,
            updatedAt: now,
          },
          minimizeDelta: false,
        });
      }
    }

    return { succeeded: updated.length, failed: uniqueIds.length - updated.length };
  });
}

export async function restoreWorkshop(
  tenant: string,
  id: string,
  restoredBy: string | null,
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const now = new Date();
    const [target] = await tx
      .select(getTableColumns(workshopEvents))
      .from(workshopEvents)
      .where(
        and(
          eq(workshopEvents.workspaceSubdomain, subdomain),
          eq(workshopEvents.id, id),
          isNotNull(workshopEvents.deletedAt),
        ),
      )
      .limit(1)
      .for("update");
    if (!target) return false;

    const [updated] = await tx
      .update(workshopEvents)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: now,
        restoredBy,
        updatedAt: now,
      })
      .where(
        and(
          eq(workshopEvents.workspaceSubdomain, subdomain),
          eq(workshopEvents.id, id),
          isNotNull(workshopEvents.deletedAt),
        ),
      )
      .returning(getTableColumns(workshopEvents));
    if (!updated) return false;

    await emitOutboxEvents([
      {
        type: "entity.restored",
        payload: {
          entityType: "workshop_events",
          entityId: id,
          tenantId: subdomain,
          restoredAt: now.toISOString(),
          restoredBy: restoredBy ?? "system",
          version: now.getTime(),
        },
      },
    ]);
    await recordModernAuditEvent({
      workspaceSubdomain: subdomain,
      tableName: "workshop_events",
      recordId: id,
      actionType: "RESTORE",
      subjectId: id,
      oldState: target,
      newState: updated,
      minimizeDelta: false,
    });
    return true;
  });
}
