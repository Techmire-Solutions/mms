import type { PlatformServiceErrorCode } from "@mms/contracts";
import { PLATFORM_SERVICE_ERROR_STATUSES } from "@mms/contracts";

export type PlatformErrorCode = PlatformServiceErrorCode;

export class PlatformError<TCode extends PlatformErrorCode = PlatformErrorCode> extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: TCode,
    message: string,
  ) {
    super(message);
    this.name = "PlatformError";
    this.statusCode = PLATFORM_SERVICE_ERROR_STATUSES[code] ?? 400;
  }
}

/**
 * SSOT for the "platform email is not configured" failure thrown by every
 * platform flow that requires email delivery (OTP dispatch, password reset).
 * `note` is an optional parenthetical appended before the closing period
 * (e.g. the deploy-time secret-merge hint).
 */
export function throwPlatformSmtpRequiredError(note?: string): never {
  const suffix = note ? ` ${note}` : "";
  throw new PlatformError(
    "smtp_required",
    `Platform email is not configured. Set PLATFORM_RESEND_API_KEY or PLATFORM_SMTP_* and PLATFORM_EMAIL_FROM${suffix}.`,
  );
}
