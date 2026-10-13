import { z } from "zod";

/**
 * `YYYY-MM` billing / pay period with a **real calendar month** (01–12).
 *
 * Stricter than `monthKeySchema` (shape-only `/^\d{4}-\d{2}$/`): a billing period
 * feeds date arithmetic and double-billing guards, so month `00`/`13` must not
 * validate. Used by invoice billing periods and accounting fee/pay periods.
 */
export const BILLING_PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Required `YYYY-MM` billing/pay period. */
export const billingPeriodSchema = z
  .string()
  .regex(BILLING_PERIOD_PATTERN, "Billing period must be YYYY-MM");
