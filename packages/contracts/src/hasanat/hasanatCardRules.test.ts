import { describe, expect, it } from "vitest";
import {
  canTransition,
  cardValue,
  consumedCardValue,
  deriveCardLifecycleState,
  evaluateQuota,
  nextStatuses,
  validateDenomPoints,
  validateIssuance,
  validateRecipient,
  validateRedemption,
  validateStatusTransition,
} from "./hasanatCardRules.js";

const TODAY = "2026-11-10";

describe("hasanat card rules", () => {
  describe("status state machine", () => {
    it("allows only the documented transitions", () => {
      expect(canTransition("active", "redeemed")).toBe(true);
      expect(canTransition("active", "returned")).toBe(true);
      expect(canTransition("returned", "active")).toBe(true);
      expect(canTransition("redeemed", "active")).toBe(false);
      expect(canTransition("redeemed", "returned")).toBe(false);
      expect(canTransition("active", "active")).toBe(false);
    });

    it("exposes the legal next statuses for the row menu", () => {
      expect(nextStatuses("active")).toEqual(["redeemed", "returned"]);
      expect(nextStatuses("returned")).toEqual(["active"]);
      expect(nextStatuses("redeemed")).toEqual([]);
    });

    it("rejects an illegal transition with a readable message", () => {
      const result = validateStatusTransition("redeemed", "active");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.violation.message).toMatch(/cannot become/i);
    });

    it("derives expiry without storing it", () => {
      expect(deriveCardLifecycleState({ status: "active", expiresOn: "2026-11-09" }, TODAY)).toBe(
        "expired",
      );
      expect(deriveCardLifecycleState({ status: "active", expiresOn: "2026-11-11" }, TODAY)).toBe(
        "active",
      );
      expect(deriveCardLifecycleState({ status: "redeemed", expiresOn: "2020-01-01" }, TODAY)).toBe(
        "redeemed",
      );
    });
  });

  describe("card value", () => {
    it("multiplies deed points by quantity and never goes negative", () => {
      expect(cardValue(50, 2)).toBe(100);
      expect(cardValue(0, 2)).toBe(0);
      expect(cardValue(-5, 2)).toBe(0);
      expect(cardValue(50, 0)).toBe(0);
    });

    it("sums redeem rows minus reversals", () => {
      expect(
        consumedCardValue([
          { kind: "redeem", pointsUsed: 50 },
          { kind: "reversal", pointsUsed: 50 },
        ]),
      ).toBe(0);
      expect(consumedCardValue([{ kind: "redeem", pointsUsed: 50 }])).toBe(50);
    });
  });

  describe("denomination bounds", () => {
    it("accepts 1..100000 and rejects anything else", () => {
      expect(validateDenomPoints(50).ok).toBe(true);
      expect(validateDenomPoints(0).ok).toBe(false);
      expect(validateDenomPoints(100_001).ok).toBe(false);
      expect(validateDenomPoints(1.5).ok).toBe(false);
    });
  });

  describe("quota", () => {
    it("treats 0/undefined as unlimited and blocks at the cap", () => {
      expect(evaluateQuota(99, 0).ok).toBe(true);
      expect(evaluateQuota(99, undefined).ok).toBe(true);
      expect(evaluateQuota(4, 5).ok).toBe(true);
      expect(evaluateQuota(5, 5).ok).toBe(false);
    });
  });

  describe("issuance", () => {
    const base = {
      denomination: { points: 50, active: true },
      quantity: 1,
      recipientType: "student" as const,
      recipientStudentId: "stu1",
      issuedDate: TODAY,
      today: TODAY,
      batchRemaining: 10,
    };

    it("accepts a well-formed card", () => {
      expect(validateIssuance(base).ok).toBe(true);
    });

    it("rejects a missing or inactive deed", () => {
      expect(validateIssuance({ ...base, denomination: null }).ok).toBe(false);
      expect(validateIssuance({ ...base, denomination: { points: 50, active: false } }).ok).toBe(
        false,
      );
    });

    it("rejects a zero-point deed", () => {
      const result = validateIssuance({ ...base, denomination: { points: 0, active: true } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.violation.code).toBe("invalid_points");
    });

    it("rejects a non-integer or zero quantity", () => {
      expect(validateIssuance({ ...base, quantity: 0 }).ok).toBe(false);
      expect(validateIssuance({ ...base, quantity: 1.5 }).ok).toBe(false);
    });

    it("rejects issuing more cards than the batch holds", () => {
      const result = validateIssuance({ ...base, quantity: 11, batchRemaining: 10 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.violation.code).toBe("insufficient_stock");
    });

    it("requires exactly one matching recipient", () => {
      expect(validateIssuance({ ...base, recipientStudentId: null }).ok).toBe(false);
      expect(validateIssuance({ ...base, recipientFacultyId: "fac1" }).ok).toBe(false);
      expect(validateRecipient("faculty", "stu1", "fac1").ok).toBe(false);
      expect(validateRecipient("faculty", null, "fac1").ok).toBe(true);
    });

    it("rejects a future issue date", () => {
      const result = validateIssuance({ ...base, issuedDate: "2026-11-11" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.violation.code).toBe("future_issue_date");
    });

    it("rejects when the instructor quota is exhausted", () => {
      const result = validateIssuance({ ...base, quota: { used: 5, limit: 5 } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.violation.code).toBe("quota_exceeded");
    });
  });

  describe("redemption", () => {
    const card = {
      status: "active" as const,
      deletedAt: null,
      expiresOn: null,
      pointsSnapshot: 50,
    };

    it("accepts an exact-value redemption of an active card", () => {
      expect(validateRedemption({ card, requestedPoints: 50, today: TODAY }).ok).toBe(true);
    });

    it("rejects a partial redemption instead of forfeiting the remainder", () => {
      const result = validateRedemption({ card, requestedPoints: 20, today: TODAY });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.violation.code).toBe("value_mismatch");
    });

    it("rejects more than the card value", () => {
      const result = validateRedemption({ card, requestedPoints: 51, today: TODAY });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.violation.code).toBe("insufficient_value");
    });

    it("rejects archived, inactive, expired and valueless cards", () => {
      expect(
        validateRedemption({
          card: { ...card, deletedAt: "2026-01-01" },
          requestedPoints: 50,
          today: TODAY,
        }).ok,
      ).toBe(false);
      expect(
        validateRedemption({
          card: { ...card, status: "redeemed" },
          requestedPoints: 50,
          today: TODAY,
        }).ok,
      ).toBe(false);
      expect(
        validateRedemption({
          card: { ...card, expiresOn: "2026-11-01" },
          requestedPoints: 50,
          today: TODAY,
        }).ok,
      ).toBe(false);
      expect(
        validateRedemption({
          card: { ...card, pointsSnapshot: 0 },
          requestedPoints: 1,
          today: TODAY,
        }).ok,
      ).toBe(false);
    });
  });
});
