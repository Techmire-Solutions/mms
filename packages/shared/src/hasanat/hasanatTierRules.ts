/**
 * Hasanat tier progression rules — pure, shared by the server (summary + reconciliation) and the
 * UI (chips and progress bars).
 *
 * The contract is deliberately explicit:
 * - the **displayed tier is always derived** from the student's current lifetime earned points;
 * - **awards are materialized evidence** and are never deleted — when a retroactive adjustment
 *   drops the student below an awarded tier, the award is revoked with a reason (D2).
 * - redemption moves *balance*, not *earned*, so burning a card never demotes a student (D1).
 */

export interface HasanatTier {
  /** Stable slug persisted on the award (`bronze`, `silver`, …). */
  key: string;
  name: string;
  /** Lifetime earned points required to hold the tier. The first tier must start at 0. */
  minPoints: number;
}

export const DEFAULT_HASANAT_TIER_LADDER: readonly HasanatTier[] = [
  { key: "bronze", name: "Bronze", minPoints: 0 },
  { key: "silver", name: "Silver", minPoints: 100 },
  { key: "gold", name: "Gold", minPoints: 250 },
  { key: "platinum", name: "Platinum", minPoints: 500 },
  { key: "diamond", name: "Diamond", minPoints: 1000 },
] as const;

export const HASANAT_TIER_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export interface HasanatTierViolation {
  code: "invalid_ladder" | "invalid_tier_key" | "invalid_threshold";
  message: string;
}

export type HasanatTierLadderResult =
  { ok: true; ladder: HasanatTier[] } | { ok: false; violation: HasanatTierViolation };

/**
 * Validates and normalizes a workspace-defined ladder: 1..12 tiers, unique slugs, whole
 * non-negative thresholds strictly ascending, first tier at 0.
 */
export function validateTierLadder(input: unknown): HasanatTierLadderResult {
  if (!Array.isArray(input) || input.length === 0) {
    return {
      ok: false,
      violation: { code: "invalid_ladder", message: "A tier ladder needs at least one tier." },
    };
  }
  if (input.length > 12) {
    return {
      ok: false,
      violation: { code: "invalid_ladder", message: "A tier ladder can hold at most 12 tiers." },
    };
  }

  const ladder: HasanatTier[] = [];
  const seen = new Set<string>();
  let previous = -1;

  for (const raw of input) {
    if (!raw || typeof raw !== "object") {
      return {
        ok: false,
        violation: { code: "invalid_ladder", message: "Every tier must be an object." },
      };
    }
    const tier = raw as Partial<HasanatTier>;
    const key = typeof tier.key === "string" ? tier.key.trim().toLowerCase() : "";
    const name = typeof tier.name === "string" ? tier.name.trim() : "";
    const minPoints = tier.minPoints;

    if (!HASANAT_TIER_KEY_PATTERN.test(key)) {
      return {
        ok: false,
        violation: {
          code: "invalid_tier_key",
          message: `Tier key "${key}" must be 1–32 lowercase letters, digits, "-" or "_".`,
        },
      };
    }
    if (seen.has(key)) {
      return {
        ok: false,
        violation: { code: "invalid_tier_key", message: `Duplicate tier key "${key}".` },
      };
    }
    if (!name) {
      return {
        ok: false,
        violation: { code: "invalid_ladder", message: `Tier "${key}" needs a name.` },
      };
    }
    if (typeof minPoints !== "number" || !Number.isInteger(minPoints) || minPoints < 0) {
      return {
        ok: false,
        violation: {
          code: "invalid_threshold",
          message: `Tier "${key}" needs a whole, non-negative point threshold.`,
        },
      };
    }
    if (minPoints <= previous) {
      return {
        ok: false,
        violation: {
          code: "invalid_threshold",
          message: "Tier thresholds must be strictly ascending, starting at 0.",
        },
      };
    }

    seen.add(key);
    previous = minPoints;
    ladder.push({ key, name, minPoints });
  }

  if (ladder[0]?.minPoints !== 0) {
    return {
      ok: false,
      violation: { code: "invalid_threshold", message: "The first tier must start at 0 points." },
    };
  }

  return { ok: true, ladder };
}

/** Ladder to use for evaluation — a malformed stored value falls back to the default. */
export function resolveTierLadder(input: unknown): HasanatTier[] {
  const result = validateTierLadder(input);
  return result.ok ? result.ladder : [...DEFAULT_HASANAT_TIER_LADDER];
}

/** Highest tier whose threshold the student has reached (never null — the ladder starts at 0). */
export function resolveTier(earned: number, ladder: readonly HasanatTier[]): HasanatTier {
  const points = Number.isFinite(earned) ? Math.max(0, Math.trunc(earned)) : 0;
  let current = ladder[0] ?? DEFAULT_HASANAT_TIER_LADDER[0];
  for (const tier of ladder) {
    if (points >= tier.minPoints) current = tier;
    else break;
  }
  return current;
}

/** Next tier after `key` (for chips/progress), or `null` at the top of the ladder. */
export function nextTierFor(key: string, ladder: readonly HasanatTier[]): HasanatTier | null {
  const index = ladder.findIndex((tier) => tier.key === key);
  return index >= 0 ? (ladder[index + 1] ?? null) : null;
}

export interface TierProgress {
  earned: number;
  tier: HasanatTier;
  nextTier: HasanatTier | null;
  /** Points still needed for the next tier (`0` at the top tier). */
  pointsToNext: number;
  /** 0..100 progress within the current tier band. */
  percentToNext: number;
}

export function tierProgress(earned: number, ladder: readonly HasanatTier[]): TierProgress {
  const points = Number.isFinite(earned) ? Math.max(0, Math.trunc(earned)) : 0;
  const tier = resolveTier(points, ladder);
  const index = ladder.findIndex((row) => row.key === tier.key);
  const nextTier = index >= 0 ? (ladder[index + 1] ?? null) : null;

  if (!nextTier) {
    return { earned: points, tier, nextTier: null, pointsToNext: 0, percentToNext: 100 };
  }

  const span = nextTier.minPoints - tier.minPoints;
  const gained = points - tier.minPoints;
  return {
    earned: points,
    tier,
    nextTier,
    pointsToNext: Math.max(0, nextTier.minPoints - points),
    percentToNext: span <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((gained / span) * 100))),
  };
}

export interface HasanatTierAward {
  tierKey: string;
  /** `null`/absent = active award. */
  revokedAt?: string | null;
  revokedReason?: string | null;
}

export interface TierChangePlan<T extends HasanatTierAward = HasanatTierAward> {
  tier: HasanatTier;
  /** Award to insert — `null` when the student already holds this tier or a higher one. */
  award: HasanatTier | null;
  /** Awards to revoke because the student no longer reaches their threshold (same objects, so any
   * caller-side id survives). */
  revoke: T[];
}

/**
 * Plans the reconciliation for one student.
 *
 * The displayed tier always follows `earned`. Materialized awards only ever move forward: a tier
 * the student reaches is recorded once, and an award above the current tier is revoked (with a
 * reason) when earned points are retroactively reduced.
 */
export function evaluateTierChange<T extends HasanatTierAward>(
  earned: number,
  awards: readonly T[],
  ladder: readonly HasanatTier[],
  options: { revokedReason?: string } = {},
): TierChangePlan<T> {
  const tier = resolveTier(earned, ladder);
  const active = awards.filter((award) => !award.revokedAt);

  const alreadyHeld = active.some((award) => award.tierKey === tier.key);
  const reachedIndex = ladder.findIndex((row) => row.key === tier.key);
  const highestHeldIndex = active.reduce((highest, award) => {
    const index = ladder.findIndex((row) => row.key === award.tierKey);
    return index > highest ? index : highest;
  }, -1);

  const award = !alreadyHeld && reachedIndex > highestHeldIndex ? tier : null;

  const revoke = active.filter((candidate): candidate is T => {
    const index = ladder.findIndex((row) => row.key === candidate.tierKey);
    // Unknown slugs (a tier removed from the ladder) are left alone rather than guessed at.
    return index > reachedIndex;
  });

  if (revoke.length === 0) return { tier, award, revoke };

  return {
    tier,
    award,
    revoke: revoke.map((candidate) => ({
      ...candidate,
      revokedReason: options.revokedReason ?? "recalculated_after_reduction",
    })) as T[],
  };
}

/** Lifetime earned points from card rows — reversals and redemption never reduce this (D1). */
export function lifetimeEarned(
  cards: ReadonlyArray<{ pointsSnapshot: number; deletedAt?: string | null }>,
): number {
  return cards.reduce(
    (total, card) => (card.deletedAt ? total : total + Math.max(0, card.pointsSnapshot)),
    0,
  );
}
