/**
 * Atomic Hasanat card redemption.
 *
 * One transaction: lock the card row, validate its state and value, write the ledger row and flip
 * the card status. The previous flow was two client requests ("upsert the redemption list", then
 * "PUT the card"), which could lose one of the writes and let the same card be burned twice.
 *
 * The database backs this up:
 *   - `0226` `BEFORE INSERT` guard serializes per card and rejects a second redemption,
 *   - `0226` unique index `hasanat_redemp_ws_dist_uidx` (where the legacy data is clean),
 *   - `0225`/`0226` CHECK constraints on `points_used` and stock.
 */

import { and, eq } from "drizzle-orm";
import { generateClientEntityId, type RedeemCardBody, type Redemption } from "@mms/shared";
import { hasanatDenoms, hasanatDistributions, hasanatRedemptions } from "../schema.js";
import { requireDbDateValue } from "../../lib/dbDate.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { runGuardedTenant } from "./hasanatConstraintErrors.js";
import { redemptionRowToRecord } from "./hasanatRedemptionsRepository.js";

export async function redeemCard(
  tenant: string,
  distributionId: string,
  input: RedeemCardBody,
): Promise<{ redemption: Redemption }> {
  const subdomain = tenant.trim().toLowerCase();

  return runGuardedTenant(subdomain, async (tx) => {
    const cards = await tx
      .select({
        id: hasanatDistributions.id,
        denominationId: hasanatDistributions.denominationId,
        recipientStudentId: hasanatDistributions.recipientStudentId,
        recipientName: hasanatDistributions.recipientName,
        quantity: hasanatDistributions.quantity,
        status: hasanatDistributions.status,
        deletedAt: hasanatDistributions.deletedAt,
      })
      .from(hasanatDistributions)
      .where(
        and(
          eq(hasanatDistributions.workspaceSubdomain, subdomain),
          eq(hasanatDistributions.id, distributionId),
        ),
      )
      // Row lock: a concurrent redemption of the same card waits here instead of racing the read.
      .for("update")
      .limit(1);

    const card = cards[0];
    if (!card || card.deletedAt) {
      throw new NotFoundError("Hasanat card not found");
    }
    if (card.status !== "active") {
      throw new ConflictError(`This Hasanat card is already ${card.status}.`);
    }

    const denomRows = await tx
      .select({ points: hasanatDenoms.points })
      .from(hasanatDenoms)
      .where(
        and(
          eq(hasanatDenoms.workspaceSubdomain, subdomain),
          eq(hasanatDenoms.id, card.denominationId),
        ),
      )
      .limit(1);

    const cardPoints = Number(denomRows[0]?.points ?? 0) * card.quantity;
    if (input.pointsUsed > cardPoints) {
      throw new ConflictError(
        `Points used (${input.pointsUsed}) exceeds the card value (${cardPoints}).`,
      );
    }

    const [inserted] = await tx
      .insert(hasanatRedemptions)
      .values({
        id: generateClientEntityId("red"),
        workspaceSubdomain: subdomain,
        distributionId: card.id,
        studentId: card.recipientStudentId ?? null,
        studentName: card.recipientName ?? "",
        reward: input.reward,
        pointsUsed: input.pointsUsed,
        date: requireDbDateValue(input.date, "date"),
        approvedByUserId: input.approvedByUserId ?? null,
        approvedBy: input.approvedBy ?? null,
        updatedAt: new Date(),
      })
      .returning();

    await tx
      .update(hasanatDistributions)
      .set({ status: "redeemed", updatedAt: new Date() })
      .where(
        and(
          eq(hasanatDistributions.workspaceSubdomain, subdomain),
          eq(hasanatDistributions.id, card.id),
        ),
      );

    return { redemption: redemptionRowToRecord(inserted) };
  });
}
