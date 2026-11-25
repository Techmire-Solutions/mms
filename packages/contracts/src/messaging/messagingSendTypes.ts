/**
 * Superset send/result shapes for outbound messaging shared by the tenant and
 * platform backends (mms-dry §2). The console-specific subsets
 * (`SendPlatformSmsResult`, `PlatformEmailResult`) fit inside these unions, so
 * every send path reports a byte-identical `{ sent, reason?, message? }` shape.
 */

/** Outbound SMS request shape. */
export interface SendSmsInput {
  /** Destination phone number (E.164 or digits; sanitized at dispatch). */
  to: string;
  /** Message body. */
  body: string;
}

/** Reasons an SMS send can fail without throwing. */
export type SendSmsFailureReason = "notifications_disabled" | "not_configured" | "transport_error";

/** Outbound SMS result envelope. */
export interface SendSmsResult {
  sent: boolean;
  reason?: SendSmsFailureReason;
  message?: string;
}

/** Outbound email request shape. */
export interface SendEmailInput {
  to: string;
  subject: string;
  /** Plain-text body; an HTML part is derived from it when `html` is absent. */
  text: string;
  /** Explicit HTML body — the derived fallback is always HTML-escaped. */
  html?: string;
}

/** Reasons an email send can fail without throwing. */
export type SendEmailFailureReason =
  "notifications_disabled" | "not_configured" | "transport_error";

/** Outbound email result envelope. */
export interface SendEmailResult {
  sent: boolean;
  reason?: SendEmailFailureReason;
  message?: string;
}
