/**
 * Shared result primitives for Hasanat rule modules (`{ ok } | { ok: false, violation }`).
 */

export const HASANAT_RULE_CODES = [
  "invalid_status_transition",
  "unknown_denomination",
  "inactive_denomination",
  "non_positive_value",
  "invalid_quantity",
  "insufficient_stock",
  "recipient_mismatch",
  "future_issue_date",
  "quota_exceeded",
  "card_not_active",
  "card_expired",
  "insufficient_value",
  "value_mismatch",
  "invalid_points",
] as const;

export type HasanatRuleCode = (typeof HASANAT_RULE_CODES)[number];

export interface HasanatRuleViolation {
  code: HasanatRuleCode;
  /** Human-readable, shown verbatim by the API and the UI. */
  message: string;
}

export type HasanatRuleResult = { ok: true } | { ok: false; violation: HasanatRuleViolation };

export const OK: HasanatRuleResult = { ok: true };

export function fail(code: HasanatRuleCode, message: string): HasanatRuleResult {
  return { ok: false, violation: { code, message } };
}
