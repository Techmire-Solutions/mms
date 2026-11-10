/**
 * Hasanat redemption use cases — the rules live here, the ledger stays append-only.
 *
 * `redeemHasanatCard` locks the card, validates against the immutable stamped value, appends the
 * ledger row and moves the card to `redeemed` in one transaction. `voidHasanatRedemption` corrects
 * a mistake by appending a `reversal` row (never by editing the original) and reopening the card.
 */

import {
  generateClientEntityId,
  type Redemption,
  type RedeemCardBody,
  validateRedemption,
} from "@mms/shared";
import { withTenant } from "../../db/tenant-context.js";
import { workspaceTodayIso } from "../../lib/workspaceDay.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { throwRuleViolation } from "./hasanatRuleErrors.js";
import type { HasanatRepository } from "../repository/hasanatRepository.js";
import { assertSessionWritable } from "./hasanatSessionGuard.js";
import { auditCardMutation, auditLedgerMutation } from "./hasanatAudit.js";

export interface RedeemActor {
  userId?: string | null;
  displayName?: string | null;
}

/** Burn an active card at its exact stamped value. Idempotent per `clientRequestId`. */
export async function redeemHasanatCard(
  tenant: string,
  distributionId: string,
  body: RedeemCardBody,
  actor: RedeemActor,
  repo: HasanatRepository,
): Promise<{ redemption: Redemption }> {
  const subdomain = tenant.trim().toLowerCase();
  const today = await workspaceTodayIso(subdomain);

  return withTenant(subdomain, async () => {
    const requestId = body.clientRequestId?.trim() || null;
    if (requestId) {
      const replay = await repo.findRedemptionByClientRequestId(subdomain, requestId);
      if (replay) return { redemption: replay };
    }

    const card = await repo.lockDistributionForUpdate(subdomain, distributionId);
    if (!card) {
      throw new NotFoundError("Hasanat card not found");
    }
    await assertSessionWritable(subdomain, card.sessionId);

    const rule = validateRedemption({
      card: {
        status: card.status,
        deletedAt: card.deletedAt ?? null,
        expiresOn: card.expiresOn ?? null,
        pointsSnapshot: card.pointsSnapshot ?? 0,
      },
      requestedPoints: body.pointsUsed,
      today,
    });
    if (!rule.ok) {
      throwRuleViolation(rule.violation);
    }

    const redemption = await repo.appendRedemption(subdomain, {
      id: generateClientEntityId("red"),
      distributionId: card.id,
      studentId: card.recipientStudentId ?? null,
      studentName: card.recipientName ?? "",
      reward: body.reward,
      pointsUsed: body.pointsUsed,
      kind: "redeem",
      reversalOfId: null,
      clientRequestId: requestId,
      date: body.date,
      approvedByUserId: body.approvedByUserId ?? actor.userId ?? null,
      approvedBy: body.approvedBy ?? actor.displayName ?? null,
    });

    await repo.setDistributionStatus(subdomain, card.id, "redeemed");

    await auditLedgerMutation({
      tenant: subdomain,
      actorUserId: actor.userId ?? body.approvedByUserId ?? null,
      action: "CREATE",
      redemption,
      reason: body.reward,
      tag: "hasanat.redeem",
    });
    await auditCardMutation({
      tenant: subdomain,
      actorUserId: actor.userId ?? null,
      action: "UPDATE",
      card: { ...card, status: "redeemed" },
      before: card,
      tag: "hasanat.status.active.redeemed",
      extra: { ledgerId: redemption.id },
    });

    return { redemption };
  });
}

export interface VoidRedemptionInput {
  reason: string;
}

/**
 * Reverse one redemption: append a `reversal` row and reopen the card.
 * The original ledger row is never mutated (the database rejects it, 0232).
 */
export async function voidHasanatRedemption(
  tenant: string,
  redemptionId: string,
  input: VoidRedemptionInput,
  actor: RedeemActor,
  repo: HasanatRepository,
): Promise<{ redemption: Redemption }> {
  const subdomain = tenant.trim().toLowerCase();
  const today = await workspaceTodayIso(subdomain);

  return withTenant(subdomain, async () => {
    const original = await repo.findLedgerRow(subdomain, redemptionId);
    if (!original) {
      throw new NotFoundError("Redemption not found");
    }
    if (original.kind === "reversal") {
      throw new ConflictError("A reversal row cannot be reversed.");
    }

    const card = await repo.lockDistributionForUpdate(subdomain, original.distributionId);
    if (!card) {
      throw new NotFoundError("Hasanat card not found");
    }
    await assertSessionWritable(subdomain, card.sessionId);
    if (await repo.hasReversal(subdomain, original.id)) {
      throw new ConflictError("This redemption has already been reversed.");
    }
    if (card.status !== "redeemed") {
      throw new ConflictError(`The card is ${card.status}; there is nothing to reverse.`);
    }

    const reversal = await repo.appendRedemption(subdomain, {
      id: generateClientEntityId("red"),
      distributionId: card.id,
      studentId: card.recipientStudentId ?? null,
      studentName: card.recipientName ?? "",
      reward: `Reversal: ${input.reason}`,
      pointsUsed: original.pointsUsed,
      kind: "reversal",
      reversalOfId: original.id,
      clientRequestId: null,
      date: today,
      approvedByUserId: actor.userId ?? null,
      approvedBy: actor.displayName ?? null,
    });

    await repo.setDistributionStatus(subdomain, card.id, "active");

    await auditLedgerMutation({
      tenant: subdomain,
      actorUserId: actor.userId ?? null,
      action: "CREATE",
      redemption: reversal,
      reason: input.reason,
      tag: "hasanat.reversal",
      extra: { originalRedemptionId: original.id },
    });
    await auditCardMutation({
      tenant: subdomain,
      actorUserId: actor.userId ?? null,
      action: "UPDATE",
      card: { ...card, status: "active" },
      before: card,
      tag: "hasanat.status.redeemed.active",
      reason: input.reason,
      extra: { ledgerId: reversal.id },
    });

    return { redemption: reversal };
  });
}
