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
  type HasanatAwardScope,
  validateIssuance,
} from "@mms/shared";
import { withTenant } from "../../db/tenant-context.js";
import { workspaceTodayIso } from "../../lib/workspaceDay.js";
import { NotFoundError } from "../../lib/httpErrors.js";
import { throwRuleViolation } from "./hasanatRuleErrors.js";
import type { HasanatRepository } from "../repository/hasanatRepository.js";
import { reconcileStudentTier } from "./hasanatTierUseCases.js";
import { assertSessionWritable } from "./hasanatSessionGuard.js";
import { assertAwardScope } from "./hasanatAwardScope.js";
import { auditCardMutation } from "./hasanatAudit.js";
import { findSessionIdForClass } from "../repository/hasanatRepositoryAdapter.js";

export interface IssueCardInput {
  body: DistributionCreate;
  /** Authenticated issuer — authoritative over any body value. */
  actorUserId: string;
  actorName?: string | null;
  quotaLimit: number | null | undefined;
  /** Workspace award-scope preference (`tenant` disables the instructor scope check). */
  awardScope?: HasanatAwardScope;
  /** Admins (holders of `hasanat.delete`) award outside their classes. */
  bypassAwardScope?: boolean;
  /** Audit reason override (the batch path has no per-card reason). */
  reason?: string | null;
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

    // Who may be awarded is checked before any rule so an out-of-scope request never reads stock.
    await assertAwardScope({
      tenant: subdomain,
      repo,
      actorUserId: input.actorUserId,
      bypass: input.bypassAwardScope === true,
      awardScope: input.awardScope ?? "tenant",
      classIds: [input.body.classId ?? null],
      studentIds: [input.body.recipientStudentId ?? null],
    });

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
      throwRuleViolation(rule.violation);
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

    // Audit first, then tier evidence — both ride the same transaction as the points change.
    await auditCardMutation({
      tenant: subdomain,
      actorUserId: input.actorUserId,
      action: "CREATE",
      card,
      reason: input.reason ?? null,
      tag: "hasanat.issue",
    });

    if (card.recipientStudentId) {
      await reconcileStudentTier(subdomain, card.recipientStudentId, {
        actorUserId: input.actorUserId,
      });
    }

    return card;
  });
}
