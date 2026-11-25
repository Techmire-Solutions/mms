import { dispatchPlatformVerificationEmail } from "./platformEmailService.js";
import { PlatformError, throwPlatformSmtpRequiredError } from "./platformErrorService.js";
import { isDevCredentialLoggingEnabled } from "@mms/be-core/logger/devLogging";

export interface DispatchPlatformOtpOptions {
  email: string;
  code: string;
  subject: string;
  bodyLines: string[];
  ttlMinutes: number;
  logLabel: string;
}

export interface PlatformOtpDispatchResult {
  sent: boolean;
  devCode?: string;
}

/** Dispatches platform verification email with standardized error handling and dev code extraction. */
export async function dispatchPlatformOtp(
  options: DispatchPlatformOtpOptions,
): Promise<PlatformOtpDispatchResult> {
  try {
    return await dispatchPlatformVerificationEmail(options);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      throwPlatformSmtpRequiredError("(GitHub Actions secrets are merged on deploy)");
    }
    throw new PlatformError(
      "email_send_failed",
      error instanceof Error ? error.message : "Failed to send verification email",
    );
  }
}

/** Utility to attach devReset or devCode hints only under the explicit local-dev gate. */
export function getDevOtpCode(dispatch: PlatformOtpDispatchResult): string | undefined {
  if (isDevCredentialLoggingEnabled() && dispatch.devCode) {
    return dispatch.devCode;
  }
  return undefined;
}
