import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { messageLogs } from "../schema.js";
import { withTenant } from "../tenant-context.js";

export { buildMessageLogClaimId } from "../../lib/messageLogClaimId.js";

/** Soft-archives active message logs for a workspace in one tenant-scoped update. */
export async function softDeleteActiveMessageLogs(workspaceSubdomain: string): Promise<void> {
  const subdomain = workspaceSubdomain?.trim().toLowerCase();
  if (!subdomain) return;
  await withTenant(subdomain, async (tx) => {
    await tx
      .update(messageLogs)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(messageLogs.workspaceSubdomain, subdomain), isNull(messageLogs.deletedAt)));
  });
}

/** Sending claims older than this are considered abandoned and may be retried. */
export const STALE_MESSAGE_LOG_CLAIM_MS = 10 * 60 * 1000;

export type MessageLogClaim = {
  id: string;
  userId: string;
  contactId: string;
  channel: string;
  body: string;
  sentAt: string;
  subject?: string | null;
  category?: string;
};

/**
 * Atomically claims one recipient for delivery.
 *
 * Returns `true` only when this caller inserted the row (first send) or
 * reclaimed a stale `sending` row older than ten minutes. Existing `sent`,
 * `failed`, or fresh `sending` rows return `false` so retries skip them.
 */
export async function claimMessageLogForDelivery(
  workspaceSubdomain: string,
  claim: MessageLogClaim,
): Promise<boolean> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  if (!subdomain) return false;
  return withTenant(subdomain, async (tx) => {
    const inserted = await tx
      .insert(messageLogs)
      .values({
        id: claim.id,
        workspaceSubdomain: subdomain,
        userId: claim.userId,
        contactId: claim.contactId,
        channel: claim.channel,
        body: claim.body,
        sentAt: claim.sentAt,
        status: "sending",
        subject: claim.subject ?? null,
        category: claim.category ?? "general",
      })
      .onConflictDoNothing({
        target: [messageLogs.workspaceSubdomain, messageLogs.id],
      })
      .returning({ id: messageLogs.id });
    if (inserted.length > 0) return true;

    const reclaimed = await tx
      .update(messageLogs)
      .set({ status: "sending", updatedAt: new Date() })
      .where(
        and(
          eq(messageLogs.workspaceSubdomain, subdomain),
          eq(messageLogs.id, claim.id),
          eq(messageLogs.status, "sending"),
          lt(messageLogs.updatedAt, new Date(Date.now() - STALE_MESSAGE_LOG_CLAIM_MS)),
        ),
      )
      .returning({ id: messageLogs.id });
    return reclaimed.length > 0;
  });
}

/** Persists the delivery outcome immediately after the gateway call. */
export async function updateMessageLogDeliveryStatus(
  workspaceSubdomain: string,
  id: string,
  status: "sent" | "failed",
  errorMessage?: string | null,
): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  if (!subdomain || !id) return;
  await withTenant(subdomain, async (tx) => {
    await tx
      .update(messageLogs)
      .set({
        status,
        errorMessage: errorMessage ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(messageLogs.workspaceSubdomain, subdomain), eq(messageLogs.id, id)));
  });
}

/**
 * Restores soft-archived message logs for a workspace with actor attribution.
 *
 * `ids` restores only archived logs with a matching id; `null` restores every
 * archived log in the workspace. Returns the number of rows restored (hard count
 * from `RETURNING` — no projections).
 */
export async function restoreArchivedMessageLog(
  workspaceSubdomain: string,
  userId: string,
  ids: string[] | null,
): Promise<number> {
  const subdomain = workspaceSubdomain?.trim().toLowerCase();
  if (!subdomain) return 0;
  const cleanIds = (ids ?? []).map((id) => id.trim()).filter((id) => id.length > 0);
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const activeConditions = [
      eq(messageLogs.workspaceSubdomain, subdomain),
      isNotNull(messageLogs.deletedAt),
    ];

    if (cleanIds.length > 0) {
      const restored = await tx
        .update(messageLogs)
        .set({
          deletedAt: null,
          deletedBy: null,
          deletionReason: null,
          restoredAt: now,
          restoredBy: userId,
          updatedAt: now,
        })
        .where(and(...activeConditions, inArray(messageLogs.id, cleanIds)))
        .returning({ id: messageLogs.id });
      return restored.length;
    }

    // `restore all` over a year-scale archive: claim bounded batches with
    // SKIP LOCKED inside the same transaction so concurrent restores do not
    // deadlock and the table is never updated in one unbounded statement.
    let total = 0;
    for (;;) {
      const batch = await tx
        .select({ id: messageLogs.id })
        .from(messageLogs)
        .where(and(...activeConditions))
        .limit(500)
        .for("update", { skipLocked: true });
      if (batch.length === 0) break;

      const restored = await tx
        .update(messageLogs)
        .set({
          deletedAt: null,
          deletedBy: null,
          deletionReason: null,
          restoredAt: now,
          restoredBy: userId,
          updatedAt: now,
        })
        .where(
          and(
            ...activeConditions,
            inArray(
              messageLogs.id,
              batch.map((row) => row.id),
            ),
          ),
        )
        .returning({ id: messageLogs.id });
      total += restored.length;
    }
    return total;
  });
}
