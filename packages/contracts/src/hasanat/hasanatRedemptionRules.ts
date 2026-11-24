/**
 * Redemption rules — an active, unexpired card is burned at its exact stamped value.
 *
 * Split from `hasanatCardRules` to keep both modules inside the 300-line ceiling; re-exported there
 * so callers keep a single import surface.
 */

import { OK, fail, type HasanatRuleResult } from "./hasanatRulePrimitives.js";
import type { HasanatCardStatus } from "./hasanatCardRules.js";

export interface HasanatRedemptionInput {
  card: {
    status: HasanatCardStatus;
    deletedAt?: string | null;
    expiresOn?: string | null;
    /** Immutable value stamped at issue (see `points_snapshot`). */
    pointsSnapshot: number;
  };
  requestedPoints: number;
  /** Tenant-local today, `YYYY-MM-DD`. */
  today: string;
}

/**
 * Redemption rule: an active, unexpired card is burned **at its exact value**.
 *
 * Partial redemption is deliberately rejected: the card model is all-or-nothing, and accepting a
 * smaller amount would silently forfeit the remainder (the card closes after one redemption).
 */
export function validateRedemption(input: HasanatRedemptionInput): HasanatRuleResult {
  if (input.card.deletedAt) {
    return fail("card_not_active", "This card has been archived.");
  }
  if (input.card.status !== "active") {
    return fail("card_not_active", `This card is already ${input.card.status}.`);
  }
  if (input.card.expiresOn && input.today > input.card.expiresOn) {
    return fail("card_expired", "This card has expired.");
  }

  const value = Math.max(0, Math.trunc(input.card.pointsSnapshot));
  if (value <= 0) {
    return fail("non_positive_value", "This card has no point value to redeem.");
  }

  const requested = Math.trunc(input.requestedPoints);
  if (!Number.isFinite(requested) || requested <= 0) {
    return fail("insufficient_value", "Points used must be greater than 0.");
  }
  if (requested > value) {
    return fail(
      "insufficient_value",
      `Points used (${requested}) exceeds the card value (${value}).`,
    );
  }
  if (requested !== value) {
    return fail(
      "value_mismatch",
      `This card must be redeemed in full (${value} points); partial redemption is not supported.`,
    );
  }

  return OK;
}

/** Consumed value of a card from its ledger rows (`redeem` adds, `reversal` subtracts). */
export function consumedCardValue(
  rows: ReadonlyArray<{ kind: "redeem" | "reversal"; pointsUsed: number }>,
): number {
  return rows.reduce(
    (total, row) => total + (row.kind === "reversal" ? -row.pointsUsed : row.pointsUsed),
    0,
  );
}
