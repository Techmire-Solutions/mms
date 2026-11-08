import { admissionsRepository as repo } from "../repository/admissionsRepositoryAdapter.js";
import { broadcastTenantUpdate } from "../../lib/livePush.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { ADMISSIONS_BROADCAST_KEY } from "./registrationPublicUseCases.js";
import { runAfterCommit } from "../../db/commitScope.js";
import { hasActiveTransaction } from "../../db/dbTransactions.js";

/**
 * Waitlist offer lifecycle (leader-only, idempotent).
 *
 *  - `expireWaitlistOffers` reverts offers whose window lapsed, so a seat offered before it was
 *    taken again does not sit in the review queue forever;
 *  - `releaseOffersIfClassFull` reverts unconsumed offers when a walk-in enrollment takes the
 *    last free seat (the offer would otherwise be approved into a full class and fail).
 */
export async function expireWaitlistOffers(
  limit = 200,
): Promise<{ reverted: number; workspaces: string[] }> {
  const rows = await repo.revertExpiredWaitlistOffers(limit);
  for (const row of rows) {
    await recordModernAuditEvent({
      workspaceSubdomain: row.workspace,
      tableName: "registration_applications",
      recordId: row.id,
      actionType: "UPDATE",
      oldState: { status: "under_review" },
      newState: { operation: "waitlist_offer_expired", status: "waitlisted" },
    });
  }
  const workspaces = [...new Set(rows.map((row) => row.workspace))];
  for (const workspace of workspaces) {
    broadcastTenantUpdate(workspace, "collection", ADMISSIONS_BROADCAST_KEY);
  }
  return { reverted: rows.length, workspaces };
}

/** Reverts an unconsumed offer set when a class no longer has a free seat. */
export async function releaseOffersIfClassFull(tenant: string, classId: string): Promise<number> {
  if (await repo.classHasFreeSeat(tenant, classId)) return 0;
  const ids = await repo.revertSeatOffersForClass(tenant, classId);
  for (const id of ids) {
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: "registration_applications",
      recordId: id,
      actionType: "UPDATE",
      oldState: { status: "under_review" },
      newState: {
        operation: "waitlist_offer_revoked",
        status: "waitlisted",
        reason: "Seat taken before approval",
      },
    });
  }
  if (ids.length > 0) broadcastTenantUpdate(tenant, "collection", ADMISSIONS_BROADCAST_KEY);
  return ids.length;
}

/** Same post-commit contract as the offer: awaited outside a transaction, queued inside one. */
export async function releaseOffersIfClassFullPostCommit(
  tenant: string,
  classId: string,
): Promise<void> {
  if (hasActiveTransaction()) {
    runAfterCommit(() => {
      void releaseOffersIfClassFull(tenant, classId);
    });
    return;
  }
  await releaseOffersIfClassFull(tenant, classId);
}
