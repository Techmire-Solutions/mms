import { admissionsRepository as repo } from "../repository/index.js";
import { withTenant } from "@mms/db/context";
import { broadcastTenantUpdate } from "@mms/be-core/realtime";
import { recordModernAuditEvent } from "@mms/be-core/audit";
import { ADMISSIONS_BROADCAST_KEY } from "./registrationPublicUseCases.js";
import { runAfterCommit } from "@mms/db/client";
import { hasActiveTransaction } from "@mms/db/client";

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
  // Revert + audit commit atomically inside the repo (the global sweep opens the transaction
  // there, so this file keeps no global-scope boundary — see enrollmentTenantBoundary.test.ts).
  const rows = await repo.revertExpiredWaitlistOffers(limit);
  const workspaces = [...new Set(rows.map((row: any) => row.workspace))];
  for (const workspace of workspaces) {
    broadcastTenantUpdate(workspace, "collection", ADMISSIONS_BROADCAST_KEY);
  }
  return { reverted: rows.length, workspaces };
}

/** Reverts an unconsumed offer set when a class no longer has a free seat. */
export async function releaseOffersIfClassFull(tenant: string, classId: string): Promise<number> {
  if (await repo.classHasFreeSeat(tenant, classId)) return 0;
  const ids = await withTenant(tenant, async (tx) => {
    const reverted = await repo.revertSeatOffersForClass(tenant, classId);
    for (const id of reverted) {
      await recordModernAuditEvent(tx, {
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
    return reverted;
  });
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
