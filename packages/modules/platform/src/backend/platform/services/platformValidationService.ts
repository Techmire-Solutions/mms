import { type PlatformPasswordForgotResult } from "@mms/contracts";
import { isDevCredentialLoggingEnabled } from "@mms/be-core/logger/devLogging";

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
