import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { contacts, workshopParticipants } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { auditRow } from "./workshopAudit.js";

/**
 * Waitlist primitives.
 *
 * A queued registration is an ordinary `workshop_participants` row with `waitlisted_at` set; it
 * does not hold a seat and is invisible to capacity/completion/attendance reads. Promotion is only
 * ever called from a transaction that already holds the `workshop_events` row lock (registration,
 * withdrawal, capacity edit, transition), so there is one mutex for the seat arithmetic — no
 * separate promoter that could double-promote.
 */

/** Oldest queued registrations whose contact is still live, in promotion order. */
async function queuedCandidates(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
  limit: number,
): Promise<Array<{ id: string; contactId: string; waitlistedAt: Date | null }>> {
  if (limit <= 0) return [];
  const rows = await tx
    .select({
      id: workshopParticipants.id,
      contactId: workshopParticipants.contactId,
      waitlistedAt: workshopParticipants.waitlistedAt,
    })
    .from(workshopParticipants)
    .innerJoin(
      contacts,
      and(
        eq(contacts.workspaceSubdomain, workshopParticipants.workspaceSubdomain),
        eq(contacts.id, workshopParticipants.contactId),
        isNull(contacts.deletedAt),
      ),
    )
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        isNull(workshopParticipants.deletedAt),
        isNotNull(workshopParticipants.waitlistedAt),
      ),
    )
    .orderBy(
      asc(workshopParticipants.waitlistedAt),
      asc(workshopParticipants.createdAt),
      asc(workshopParticipants.id),
    )
    .limit(limit);
  return rows;
}

/** Number of live queued rows (all, including archived contacts). */
export async function countWaitlistedTx(
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
        isNotNull(workshopParticipants.waitlistedAt),
      ),
    );
  return Number(row?.count ?? 0);
}

/**
 * Promotes up to `limit` of the oldest queued registrations with a live contact.
 *
 * The conditional `waitlisted_at IS NOT NULL` on the UPDATE makes the operation idempotent under a
 * retry, and returning the moved ids lets the caller read the promoted participants back and tell
 * the user who moved. Rows whose contact was archived after queueing are skipped (their row stays
 * queued until staff clean it up).
 */
export async function promoteOldestWaitlistTx(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
  limit: number,
  at: Date = new Date(),
): Promise<string[]> {
  const candidates = await queuedCandidates(tx, subdomain, workshopId, limit);
  if (candidates.length === 0) return [];
  const ids = candidates.map((row) => row.id);
  const promoted = await tx
    .update(workshopParticipants)
    .set({ waitlistedAt: null, updatedAt: at })
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        inArray(workshopParticipants.id, ids),
        isNull(workshopParticipants.deletedAt),
        isNotNull(workshopParticipants.waitlistedAt),
      ),
    )
    .returning({ id: workshopParticipants.id });
  const byId = new Map(candidates.map((row) => [row.id, row]));
  for (const row of promoted) {
    const before = byId.get(row.id);
    await auditRow(tx, {
      workspaceSubdomain: subdomain,
      tableName: "workshop_participants",
      recordId: row.id,
      actionType: "UPDATE",
      ...(before ? { subjectId: before.contactId } : {}),
      oldState: { waitlistedAt: before?.waitlistedAt ?? null },
      newState: { waitlistedAt: null, operation: "waitlist_promoted" },
    });
  }
  return promoted.map((row) => row.id);
}
