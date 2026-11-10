/**
 * Hasanat Cards domain rules — pure, dependency-free, shared by backend use cases and the UI.
 *
 * Everything that decides *whether* something may happen lives here: card state transitions,
 * the card's point value, issuance bounds, the instructor daily quota and the redemption rule.
 * Callers (use cases, components) supply data and apply the result; no I/O happens in this module.
 */

/** Persisted card states. `expired` is derived (time-based), never stored. */
import { OK, fail, type HasanatRuleResult } from "./hasanatRulePrimitives.js";

export const HASANAT_CARD_STATUSES = ["active", "redeemed", "returned"] as const;
export type HasanatCardStatus = (typeof HASANAT_CARD_STATUSES)[number];

/** Derived lifecycle state shown in the UI — persisted status plus time-based expiry. */
export type HasanatCardLifecycleState = HasanatCardStatus | "expired";

export * from "./hasanatRulePrimitives.js";

/**
 * Legal transitions. `redeemed` is terminal: the only way back is a ledger reversal, which the
 * use case performs together with the `returned → active` edge (not a client-driven status edit).
 */
export const HASANAT_CARD_TRANSITIONS: Readonly<
  Record<HasanatCardStatus, readonly HasanatCardStatus[]>
> = {
  active: ["redeemed", "returned"],
  redeemed: [],
  returned: ["active"],
};

/** Whether `from → to` is a legal persisted transition. */
export function canTransition(from: HasanatCardStatus, to: HasanatCardStatus): boolean {
  return HASANAT_CARD_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Legal next persisted states for a card — drives the row-action menu. */
export function nextStatuses(from: HasanatCardStatus): HasanatCardStatus[] {
  return [...(HASANAT_CARD_TRANSITIONS[from] ?? [])];
}

/**
 * Persisted status plus time-based expiry. An `active` card past `expiresOn` reads as `expired`
 * without any stored transition (no cron, no status write).
 */
export function deriveCardLifecycleState(
  card: { status: HasanatCardStatus; expiresOn?: string | null },
  today: string,
): HasanatCardLifecycleState {
  if (card.status === "active" && card.expiresOn && today > card.expiresOn) return "expired";
  return card.status;
}

/** Point value of a card: per-unit deed points × quantity, never negative. */
export function cardValue(pointsPerUnit: number, quantity: number): number {
  const points = Number.isFinite(pointsPerUnit) ? Math.trunc(pointsPerUnit) : 0;
  const units = Number.isFinite(quantity) ? Math.trunc(quantity) : 0;
  if (points <= 0 || units <= 0) return 0;
  return points * units;
}

export function validateStatusTransition(
  from: HasanatCardStatus,
  to: HasanatCardStatus,
): HasanatRuleResult {
  if (from === to) return fail("invalid_status_transition", `The card is already ${from}.`);
  if (!canTransition(from, to)) {
    return fail("invalid_status_transition", `A ${from} card cannot become ${to}.`);
  }
  return OK;
}

/** Denominations must carry a sane, positive per-unit value. */
export function validateDenomPoints(
  points: number,
  bounds: { min?: number; max?: number } = {},
): HasanatRuleResult {
  const min = bounds.min ?? 1;
  const max = bounds.max ?? 100_000;
  if (!Number.isFinite(points) || !Number.isInteger(points)) {
    return fail("invalid_points", "Points must be a whole number.");
  }
  if (points < min) {
    return fail("invalid_points", `Points must be at least ${min}.`);
  }
  if (points > max) {
    return fail("invalid_points", `Points must not exceed ${max}.`);
  }
  return OK;
}

/** Instructor daily quota — `limit <= 0` means unlimited. */
export function evaluateQuota(used: number, limit: number | null | undefined): HasanatRuleResult {
  const cap = Number.isFinite(limit ?? NaN) ? Math.trunc(limit as number) : 0;
  if (cap <= 0) return OK;
  if (used >= cap) {
    return fail(
      "quota_exceeded",
      `Daily awarding limit reached (${cap} card${cap === 1 ? "" : "s"} per instructor).`,
    );
  }
  return OK;
}

export interface HasanatIssuanceInput {
  denomination: { points: number; active: boolean } | null | undefined;
  quantity: number;
  recipientType: "student" | "faculty";
  recipientStudentId?: string | null;
  recipientFacultyId?: string | null;
  /** `YYYY-MM-DD` calendar day of issue. */
  issuedDate: string;
  /** Tenant-local today, `YYYY-MM-DD`. */
  today: string;
  /** Live stock for the target batch; `null`/`undefined` skips the check (unknown). */
  batchRemaining?: number | null;
  /** Instructor usage for this issued date; `null` skips the check. */
  quota?: { used: number; limit: number | null | undefined } | null;
}

/** Every rule that must hold before a card is written. */
export function validateIssuance(input: HasanatIssuanceInput): HasanatRuleResult {
  const denom = input.denomination;
  if (!denom) {
    return fail("unknown_denomination", "The selected denomination does not exist.");
  }
  if (!denom.active) {
    return fail("inactive_denomination", "The selected denomination is inactive.");
  }
  const pointsCheck = validateDenomPoints(denom.points);
  if (!pointsCheck.ok) return pointsCheck;

  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    return fail("invalid_quantity", "Quantity must be a whole number of at least 1.");
  }

  if (typeof input.batchRemaining === "number" && input.quantity > input.batchRemaining) {
    return fail(
      "insufficient_stock",
      `Only ${input.batchRemaining} card(s) remain in the selected batch.`,
    );
  }

  const recipientCheck = validateRecipient(
    input.recipientType,
    input.recipientStudentId,
    input.recipientFacultyId,
  );
  if (!recipientCheck.ok) return recipientCheck;

  if (input.issuedDate > input.today) {
    return fail("future_issue_date", "The issue date cannot be in the future.");
  }

  if (input.quota) {
    const quotaCheck = evaluateQuota(input.quota.used, input.quota.limit);
    if (!quotaCheck.ok) return quotaCheck;
  }

  return OK;
}

/** Exactly one recipient, matching the declared recipient type. */
export function validateRecipient(
  recipientType: "student" | "faculty",
  recipientStudentId?: string | null,
  recipientFacultyId?: string | null,
): HasanatRuleResult {
  const student = recipientStudentId?.trim() || null;
  const faculty = recipientFacultyId?.trim() || null;
  if (student && faculty) {
    return fail("recipient_mismatch", "A card has exactly one recipient.");
  }
  if (recipientType === "student" && !student) {
    return fail("recipient_mismatch", "Select a student recipient.");
  }
  if (recipientType === "faculty" && !faculty) {
    return fail("recipient_mismatch", "Select a faculty recipient.");
  }
  return OK;
}

/**
 * A card belongs to the academic session it was issued in. Once that session is completed,
 * cancelled or archived, Hasanat no longer accepts writes against it — the sanctioned override is
 * reopening the session through the session lifecycle, not a second lock here.
 */
export function cardWriteBlockedBySessionStatus(sessionStatus: string | null | undefined): boolean {
  const status = (sessionStatus ?? "").trim().toLowerCase();
  return status === "completed" || status === "cancelled" || status === "archived";
}

export function cardWriteBlockedMessage(sessionStatus: string): string {
  return `This card belongs to a ${sessionStatus} session; reopen the session before changing Hasanat points.`;
}

export interface HasanatBatchIssuanceInput {
  denomination: { points: number; active: boolean } | null | undefined;
  recipientCount: number;
  /** Live stock for the target batch; `null`/`undefined` skips the check (unknown). */
  batchRemaining?: number | null;
  issuedDate: string;
  today: string;
  /** Instructor usage for this issued date; `null` skips the check. */
  quota?: { used: number; limit: number | null | undefined } | null;
}

/** Batch rules: the same deed/date/stock checks, plus the quota must fit the whole group. */
export function validateBatchIssuance(input: HasanatBatchIssuanceInput): HasanatRuleResult {
  const denom = input.denomination;
  if (!denom) {
    return fail("unknown_denomination", "The selected denomination does not exist.");
  }
  if (!denom.active) {
    return fail("inactive_denomination", "The selected denomination is inactive.");
  }
  const pointsCheck = validateDenomPoints(denom.points);
  if (!pointsCheck.ok) return pointsCheck;

  if (!Number.isInteger(input.recipientCount) || input.recipientCount < 1) {
    return fail("invalid_quantity", "A batch award needs at least one recipient.");
  }

  if (typeof input.batchRemaining === "number" && input.recipientCount > input.batchRemaining) {
    return fail(
      "insufficient_stock",
      `Only ${input.batchRemaining} card(s) remain in the selected batch for ${input.recipientCount} recipient(s).`,
    );
  }

  if (input.issuedDate > input.today) {
    return fail("future_issue_date", "The issue date cannot be in the future.");
  }

  if (input.quota) {
    const limit = Number.isFinite(input.quota.limit ?? NaN)
      ? Math.trunc(input.quota.limit as number)
      : 0;
    if (limit > 0 && input.quota.used + input.recipientCount > limit) {
      const remaining = Math.max(0, limit - input.quota.used);
      return fail(
        "quota_exceeded",
        `The daily awarding limit leaves ${remaining} card(s) for this instructor.`,
      );
    }
  }

  return OK;
}

export * from "./hasanatRedemptionRules.js";
