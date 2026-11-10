/**
 * Hasanat issuance use case — owns every rule that decides whether a card may be written.
 *
 * The transaction is opened here (`withTenant`); the repository functions join it, so the quota
 * count, the stock read and the insert are one atomic unit. The value stamped on the card
 * (`pointsSnapshot`) is immutable from then on (0230).
 */

import {
  cardValue,
  generateClientEntityId,
  type Distribution,
  type DistributionCreate,
  validateIssuance,
} from "@mms/shared";
import { withTenant } from "../../db/tenant-context.js";
import { workspaceTodayIso } from "../../lib/workspaceDay.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import type { HasanatRepository } from "../repository/hasanatRepository.js";
import { reconcileStudentTier } from "./hasanatTierUseCases.js";
import { assertSessionWritable } from "./hasanatSessionGuard.js";
import { findSessionIdForClass } from "../repository/hasanatRepositoryAdapter.js";

export interface IssueCardInput {
  body: DistributionCreate;
  /** Authenticated issuer — authoritative over any body value. */
  actorUserId: string;
  actorName?: string | null;
  quotaLimit: number | null | undefined;
}

/**
 * Issues one card. Replaying the same `clientRequestId` returns the card already issued.
 */
export async function issueHasanatCard(
  tenant: string,
  input: IssueCardInput,
  repo: HasanatRepository,
): Promise<Distribution> {
  const subdomain = tenant.trim().toLowerCase();
  const today = await workspaceTodayIso(subdomain);

  return withTenant(subdomain, async () => {
    const requestedId = input.body.clientRequestId?.trim() || null;
    if (requestedId) {
      const replay = await repo.findDistributionByClientRequestId(subdomain, requestedId);
      if (replay) return replay;
    }

    const denomination = await repo.findDenomById(subdomain, input.body.denominationId);
    const batchRemaining = await repo.findBatchRemaining(subdomain, input.body.batchId);

    // Cards belong to the session they are issued in; a closed session accepts no new points.
    const targetSessionId =
      input.body.sessionId ??
      (input.body.classId ? await findSessionIdForClass(subdomain, input.body.classId) : null);
    await assertSessionWritable(subdomain, targetSessionId);

    // Serialize the quota check with concurrent issues by the same instructor on the same day.
    await repo.lockInstructorQuota(subdomain, input.actorUserId, input.body.issuedDate);
    const quotaUsed = await repo.countIssuedByUserOnDate(
      subdomain,
      input.actorUserId,
      input.body.issuedDate,
    );

    const rule = validateIssuance({
      denomination,
      quantity: input.body.quantity,
      recipientType: input.body.recipientType,
      recipientStudentId: input.body.recipientStudentId,
      recipientFacultyId: input.body.recipientFacultyId,
      issuedDate: input.body.issuedDate,
      today,
      batchRemaining,
      quota: { used: quotaUsed, limit: input.quotaLimit },
    });
    if (!rule.ok) {
      throw new ConflictError(rule.violation.message);
    }

    if (!denomination) {
      // Unreachable after validateIssuance, but keeps the compiler honest about `points`.
      throw new NotFoundError("The selected denomination does not exist.");
    }

    const card = await repo.insertDistribution(subdomain, {
      id: input.body.id?.trim() || generateClientEntityId("hd"),
      batchId: input.body.batchId,
      denominationId: input.body.denominationId,
      denominationName: input.body.denominationName || denomination.name,
      recipientType: input.body.recipientType,
      recipientStudentId: input.body.recipientStudentId ?? null,
      recipientFacultyId: input.body.recipientFacultyId ?? null,
      recipientName: input.body.recipientName ?? "",
      recipientClass: input.body.recipientClass ?? "",
      classId: input.body.classId ?? null,
      sessionId: input.body.sessionId ?? null,
      quantity: input.body.quantity,
      pointsSnapshot: cardValue(denomination.points, input.body.quantity),
      clientRequestId: requestedId,
      expiresOn: input.body.expiresOn ?? null,
      reason: input.body.reason ?? "",
      issuedDate: input.body.issuedDate,
      issuedByUserId: input.actorUserId,
      issuedBy: input.actorName ?? input.body.issuedBy ?? null,
    });

    // Tier/badge evidence is reconciled in the same transaction as the points change.
    if (card.recipientStudentId) {
      await reconcileStudentTier(subdomain, card.recipientStudentId);
    }

    return card;
  });
}
