/**
 * Maps a shared `HasanatRuleViolation` to the HTTP error taxonomy.
 *
 * The rule modules stay free of HTTP concerns; this is the single translation point so every
 * rejection carries a stable machine-readable `type` (and the rule `code` in `details`).
 *
 * Status mapping (D1): 409 for state conflicts, 422 for policy rejections, 400 for payload shape
 * (handled by request validation before the use case runs).
 */

import type { HasanatRuleViolation } from "@mms/shared";
import { ConflictError, PolicyViolationError } from "../../lib/httpErrors.js";

/** Rule codes that are policy refusals rather than state conflicts. */
const POLICY_CODES = new Set<HasanatRuleViolation["code"]>([
  "value_mismatch",
  "insufficient_value",
  "non_positive_value",
  "card_expired",
  "invalid_points",
]);

export function throwRuleViolation(violation: HasanatRuleViolation): never {
  const details = { code: violation.code };
  if (POLICY_CODES.has(violation.code)) {
    throw new PolicyViolationError(violation.message, violation.code, details);
  }
  throw new ConflictError(violation.message, violation.code, details);
}
