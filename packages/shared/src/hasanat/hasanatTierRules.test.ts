import { describe, expect, it } from "vitest";
import {
  DEFAULT_HASANAT_TIER_LADDER,
  evaluateTierChange,
  lifetimeEarned,
  nextTierFor,
  resolveTier,
  resolveTierLadder,
  tierProgress,
  validateTierLadder,
} from "./hasanatTierRules.js";

const LADDER = [
  { key: "bronze", name: "Bronze", minPoints: 0 },
  { key: "silver", name: "Silver", minPoints: 100 },
  { key: "gold", name: "Gold", minPoints: 250 },
];

describe("hasanat tier rules", () => {
  describe("ladder validation", () => {
    it("accepts the default ladder", () => {
      expect(validateTierLadder(DEFAULT_HASANAT_TIER_LADDER).ok).toBe(true);
    });

    it("rejects an empty, unordered, duplicated or non-zero-based ladder", () => {
      expect(validateTierLadder([]).ok).toBe(false);
      expect(
        validateTierLadder([
          { key: "a", name: "A", minPoints: 10 },
          { key: "b", name: "B", minPoints: 5 },
        ]).ok,
      ).toBe(false);
      expect(
        validateTierLadder([
          { key: "a", name: "A", minPoints: 0 },
          { key: "a", name: "B", minPoints: 10 },
        ]).ok,
      ).toBe(false);
      expect(validateTierLadder([{ key: "a", name: "A", minPoints: 5 }]).ok).toBe(false);
    });

    it("rejects bad slugs, negative and fractional thresholds", () => {
      expect(validateTierLadder([{ key: "Bad Slug", name: "A", minPoints: 0 }]).ok).toBe(false);
      expect(validateTierLadder([{ key: "a", name: "A", minPoints: -1 }]).ok).toBe(false);
      expect(validateTierLadder([{ key: "a", name: "A", minPoints: 1.5 }]).ok).toBe(false);
    });

    it("falls back to the default ladder when the stored value is malformed", () => {
      expect(resolveTierLadder("nope")).toEqual([...DEFAULT_HASANAT_TIER_LADDER]);
    });
  });

  describe("resolution", () => {
    it("resolves the highest reached tier at exact thresholds", () => {
      expect(resolveTier(0, LADDER).key).toBe("bronze");
      expect(resolveTier(99, LADDER).key).toBe("bronze");
      expect(resolveTier(100, LADDER).key).toBe("silver");
      expect(resolveTier(249, LADDER).key).toBe("silver");
      expect(resolveTier(250, LADDER).key).toBe("gold");
      expect(resolveTier(9999, LADDER).key).toBe("gold");
    });

    it("clamps negative and non-finite input to the first tier", () => {
      expect(resolveTier(-50, LADDER).key).toBe("bronze");
      expect(resolveTier(Number.NaN, LADDER).key).toBe("bronze");
    });

    it("reports progress towards the next tier", () => {
      expect(tierProgress(150, LADDER)).toMatchObject({
        tier: { key: "silver" },
        nextTier: { key: "gold" },
        pointsToNext: 100,
        percentToNext: 33,
      });
      expect(tierProgress(5000, LADDER)).toMatchObject({
        tier: { key: "gold" },
        nextTier: null,
        pointsToNext: 0,
        percentToNext: 100,
      });
    });

    it("exposes the next tier for the UI", () => {
      expect(nextTierFor("silver", LADDER)?.key).toBe("gold");
      expect(nextTierFor("gold", LADDER)).toBeNull();
      expect(nextTierFor("unknown", LADDER)).toBeNull();
    });
  });

  describe("reconciliation (evaluateTierChange)", () => {
    it("awards the reached tier once", () => {
      const plan = evaluateTierChange(120, [], LADDER);
      expect(plan.tier.key).toBe("silver");
      expect(plan.award?.key).toBe("silver");
      expect(plan.revoke).toEqual([]);
    });

    it("does not re-award an already-held tier", () => {
      const plan = evaluateTierChange(120, [{ tierKey: "silver" }], LADDER);
      expect(plan.award).toBeNull();
      expect(plan.revoke).toEqual([]);
    });

    it("awards a higher tier without touching the held one", () => {
      const plan = evaluateTierChange(260, [{ tierKey: "silver" }], LADDER);
      expect(plan.award?.key).toBe("gold");
      expect(plan.revoke).toEqual([]);
    });

    it("revokes an award above the current tier after a retroactive reduction", () => {
      const plan = evaluateTierChange(90, [{ tierKey: "silver" }, { tierKey: "bronze" }], LADDER);
      expect(plan.tier.key).toBe("bronze");
      expect(plan.award).toBeNull();
      expect(plan.revoke).toHaveLength(1);
      expect(plan.revoke[0]).toMatchObject({
        tierKey: "silver",
        revokedReason: "recalculated_after_reduction",
      });
    });

    it("re-awards after a revoked award when points recover", () => {
      const plan = evaluateTierChange(
        120,
        [
          {
            tierKey: "silver",
            revokedAt: "2026-01-01",
            revokedReason: "recalculated_after_reduction",
          },
        ],
        LADDER,
      );
      expect(plan.award?.key).toBe("silver");
      expect(plan.revoke).toEqual([]);
    });

    it("leaves awards for slugs no longer in the ladder alone", () => {
      const plan = evaluateTierChange(10, [{ tierKey: "legacy-emerald" }], LADDER);
      expect(plan.revoke).toEqual([]);
    });
  });

  describe("lifetime earned", () => {
    it("ignores deleted cards and never subtracts", () => {
      expect(
        lifetimeEarned([
          { pointsSnapshot: 50 },
          { pointsSnapshot: 20, deletedAt: "2026-01-01" },
          { pointsSnapshot: 10 },
        ]),
      ).toBe(60);
      expect(lifetimeEarned([])).toBe(0);
    });
  });
});
