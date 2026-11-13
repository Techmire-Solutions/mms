import { z } from "zod";

/**
 * Machine-readable codes for Accounting domain rejections.
 *
 * The shared envelope carries `type` (a coarse bucket: `validation_error`,
 * `conflict`, …) and `message` (human text, translated by the UI). Neither is a
 * stable programmatic contract: six different 422s — unbalanced voucher, closed
 * posting period, locked fiscal year, non-postable header account, account
 * currency lock, missing exchange rate — all answer `type: "validation_error"`,
 * so a client could only tell them apart by matching English prose. `code` is the
 * stable discriminator; it is additive (optional on the envelope) so clients that
 * never read it are unaffected.
 */
export const ACCOUNTING_ERROR_CODES = {
  /** Debits and credits do not balance (or a foreign leg does not convert). */
  voucherUnbalanced: "accounting.voucher.unbalanced",
  /** The voucher is posted and therefore immutable. */
  voucherPosted: "accounting.voucher.posted",
  /** A reversal already exists for this voucher. */
  voucherAlreadyReversed: "accounting.voucher.already-reversed",
  /** This source type or state cannot be reversed (draft, invoice posting, …). */
  reversalNotAllowed: "accounting.reversal.not-allowed",
  /** The posting period covering the date is closed. */
  periodClosed: "accounting.period.closed",
  /** The fiscal year is closed and rejects the write. */
  yearClosed: "accounting.year.closed",
  /** The year-end close still has preconditions to satisfy. */
  yearCloseBlocked: "accounting.year.close-blocked",
  /** The account cannot carry a journal line (archived, inactive, or a summary row). */
  accountNotPostable: "accounting.account.not-postable",
  /** The actor may draft vouchers but not post them (missing `accounting.post`). */
  postRequired: "accounting.post.required",
  /** The line's currency differs from the account's currency lock (IAS 21). */
  accountCurrencyLocked: "accounting.account.currency-locked",
  /** No CLOSING/SPOT rate exists for the requested currency and date. */
  fxNoRate: "accounting.fx.no-rate",
  /** The currency lacks exchangeability and needs an estimated rate (IAS 21.19A). */
  fxLackOfExchangeability: "accounting.fx.lack-of-exchangeability",
} as const;

export type AccountingErrorCode =
  (typeof ACCOUNTING_ERROR_CODES)[keyof typeof ACCOUNTING_ERROR_CODES];

/** The error envelope every Accounting route answers with (4xx and 5xx). */
export const accountingErrorEnvelopeSchema = z
  .object({
    type: z.string(),
    message: z.string(),
    /** Present when the rejection has a stable programmatic meaning. */
    code: z.string().optional(),
    /** Machine-readable reasons (e.g. blocked lifecycle transitions). */
    violations: z.array(z.string()).optional(),
    /** Structured context the UI can act on without parsing the message. */
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type AccountingErrorEnvelope = z.infer<typeof accountingErrorEnvelopeSchema>;
