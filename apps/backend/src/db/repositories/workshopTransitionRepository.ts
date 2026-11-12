import { and, eq, getTableColumns, isNotNull, isNull, sql } from "drizzle-orm";
import { workshopEvents, workshopParticipants } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { auditRow } from "./workshopAudit.js";

/**
 * Tx-scoped primitives for the workshop lifecycle service.
 *
 * The lifecycle decision (which transition is legal, whether registration is still open) lives in
 * `@mms/shared` + `workshops/domain`; this module only performs the reads and writes the caller
 * needs **inside a single transaction**: lock the event, count the seats/certificates the guards
 * need, move the status with a compare-and-set, and archive the registrations a cancel voids.
 * Everything here takes the caller's transaction — the service owns the boundary, so the guard
 * evaluation and the write cannot straddle two snapshots.
 */

export type WorkshopRow = typeof workshopEvents.$inferSelect;

/** Locks the active workshop row (`FOR UPDATE`); null when it does not exist or is archived. */
export async function lockWorkshopTx(
  tx: TenantTransaction,
  subdomain: string,
  id: string,
): Promise<WorkshopRow | null> {
  const [row] = await tx
    .select(getTableColumns(workshopEvents))
    .from(workshopEvents)
    .where(
      and(
        eq(workshopEvents.workspaceSubdomain, subdomain),
        eq(workshopEvents.id, id),
        isNull(workshopEvents.deletedAt),
      ),
    )
    .limit(1)
    .for("update");
  return row ?? null;
}

/** Active registrations (the seats a capacity/transition guard must count). */
export async function countLiveParticipantsTx(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(workshopParticipants)
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        isNull(workshopParticipants.deletedAt),
      ),
    );
  return Number(row?.count ?? 0);
}

/** Issued participation certificates — cancelling after this point is refused. */
export async function countCertificatesTx(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(workshopParticipants)
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        isNull(workshopParticipants.deletedAt),
        isNotNull(workshopParticipants.certificateIssuedAt),
      ),
    );
  return Number(row?.count ?? 0);
}

/**
 * Compare-and-set on the current status. Returns null when another writer moved the row first —
 * the caller turns that into a `409 stale_workshop` instead of overwriting it.
 */
export async function updateWorkshopStatusIfTx(
  tx: TenantTransaction,
  subdomain: string,
  id: string,
  fromStatus: string,
  toStatus: string,
  at: Date,
): Promise<WorkshopRow | null> {
  const [row] = await tx
    .update(workshopEvents)
    .set({ status: toStatus, updatedAt: at })
    .where(
      and(
        eq(workshopEvents.workspaceSubdomain, subdomain),
        eq(workshopEvents.id, id),
        eq(workshopEvents.status, fromStatus),
        isNull(workshopEvents.deletedAt),
      ),
    )
    .returning(getTableColumns(workshopEvents));
  return row ?? null;
}

export interface ArchivedRegistration {
  id: string;
  contactId: string;
}

/**
 * Cancelling a workshop voids its live registrations: they are soft-deleted with provenance
 * (`deleted_with_cascade`) so reports stop counting them and a restore of the workshop stays an
 * explicit decision (cancelled stays terminal).
 */
export async function archiveWorkshopRegistrationsTx(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
  input: { actorId: string | null; reason: string; at: Date },
): Promise<ArchivedRegistration[]> {
  const before = await tx
    .select(getTableColumns(workshopParticipants))
    .from(workshopParticipants)
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        isNull(workshopParticipants.deletedAt),
      ),
    );
  const archived = await tx
    .update(workshopParticipants)
    .set({
      deletedAt: input.at,
      deletedBy: input.actorId,
      deletionReason: input.reason,
      deletedWithCascade: true,
      updatedAt: input.at,
    })
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        isNull(workshopParticipants.deletedAt),
      ),
    )
    .returning({ id: workshopParticipants.id, contactId: workshopParticipants.contactId });
  const beforeById = new Map(before.map((row) => [row.id, row]));
  for (const row of archived) {
    const oldState = beforeById.get(row.id);
    await auditRow(tx, {
      workspaceSubdomain: subdomain,
      tableName: "workshop_participants",
      recordId: row.id,
      actionType: "DELETE",
      subjectId: row.contactId,
      ...(oldState ? { oldState } : {}),
      newState: {
        ...(oldState ?? {}),
        id: row.id,
        contactId: row.contactId,
        deletedAt: input.at,
        deletedBy: input.actorId,
        deletionReason: input.reason,
        deletedWithCascade: true,
        updatedAt: input.at,
      },
    });
  }
  return archived;
}
