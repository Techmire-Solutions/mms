import { type PlatformPasswordForgotResult } from "@mms/shared";
import { isDevCredentialLoggingEnabled } from "../../lib/devLogging.js";

/**
 * Normalizes OTP dispatching results for non-production environments to avoid code duplication in password reset flows.
 */
export function buildDevForgotResult(
  dispatch: { sent: boolean; devCode?: string },
  resetId: string,
): PlatformPasswordForgotResult {
  const result: PlatformPasswordForgotResult = { accepted: true };
  if (isDevCredentialLoggingEnabled() && dispatch.devCode) {
    result.devReset = { resetId, code: dispatch.devCode };
  }
  return result;
}
