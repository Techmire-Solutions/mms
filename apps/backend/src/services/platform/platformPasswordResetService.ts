import type { PlatformPasswordForgotResult, StoredPlatformUser } from "@mms/shared";
import {
  normalizePlatformEmail,
  PLATFORM_OTP_MAX_ATTEMPTS,
  PLATFORM_PASSWORD_RESET_TTL_MINUTES,
} from "@mms/shared";
import {
  createArtifactId,
  deleteAuthArtifact,
  getAuthArtifact,
  putAuthArtifact,
} from "../auth/authArtifactService.js";
import { isDevCredentialLoggingEnabled } from "../../lib/devLogging.js";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "../auth/authCookieService.js";
import { hashPassword } from "../auth/passwordService.js";
import { isPlatformSmtpConfigured, resolvePlatformAppOrigin } from "./platformEmailService.js";
import { PlatformError } from "./platformErrorService.js";
import { dispatchPlatformOtp } from "./platformOtpService.js";
import { findPlatformUserByEmail, updatePlatformUserPassword } from "./platformUserService.js";
import { buildDevForgotResult } from "./platformValidationService.js";

const RESET_TTL_MS = PLATFORM_PASSWORD_RESET_TTL_MINUTES * 60 * 1000;

export interface PlatformPasswordResetPayload {
  userId: string;
  email: string;
  codeHash: string;
  attempts: number;
}

function buildResetUrl(resetId: string): string {
  const origin = resolvePlatformAppOrigin();
  return `${origin}/platform/forgot-password?resetId=${encodeURIComponent(resetId)}`;
}

async function dispatchResetCode(
  email: string,
  code: string,
  resetId: string,
): Promise<{ sent: boolean; devCode?: string }> {
  return dispatchPlatformOtp({
    email,
    code,
    subject: "Reset your MMS platform password",
    bodyLines: [
      "Use this verification code to reset your platform administrator password:",
      "",
      `Or open this link: ${buildResetUrl(resetId)}`,
    ],
    ttlMinutes: PLATFORM_PASSWORD_RESET_TTL_MINUTES,
    logLabel: "Platform password reset code",
  });
}

function assertResetEmailDeliverable(dispatch: { sent: boolean; devCode?: string }): void {
  if (dispatch.sent) return;
  if (isDevCredentialLoggingEnabled() && dispatch.devCode) return;
  throw new PlatformError(
    "email_send_failed",
    "Failed to send password reset email. Configure PLATFORM_RESEND_API_KEY or PLATFORM_SMTP_* and PLATFORM_EMAIL_FROM.",
  );
}

function assertPlatformSmtpReady(): void {
  if (process.env.NODE_ENV === "production" && !isPlatformSmtpConfigured()) {
    throw new PlatformError(
      "smtp_required",
      "Platform email is not configured. Set PLATFORM_RESEND_API_KEY or PLATFORM_SMTP_* and PLATFORM_EMAIL_FROM.",
    );
  }
}

/** Always returns accepted for unknown emails — does not reveal whether the email is registered. */
export async function requestPlatformPasswordReset(
  emailInput: string,
): Promise<PlatformPasswordForgotResult> {
  assertPlatformSmtpReady();

  const email = normalizePlatformEmail(emailInput);
  const user = await findPlatformUserByEmail(email);
  if (!user || user.disabledAt) {
    return { accepted: true };
  }

  const code = generateOtpCode();
  const resetId = createArtifactId();

  await putAuthArtifact<PlatformPasswordResetPayload>(
    "platform_password_reset",
    {
      userId: user.id,
      email,
      codeHash: hashOtpCode(code),
      attempts: 0,
    },
    RESET_TTL_MS,
    resetId,
  );

  try {
    const dispatch = await dispatchResetCode(email, code, resetId);
    assertResetEmailDeliverable(dispatch);
    return buildDevForgotResult(dispatch, resetId);
  } catch (error) {
    await deleteAuthArtifact(resetId);
    throw error;
  }
}

export async function resendPlatformPasswordReset(
  resetId: string,
): Promise<PlatformPasswordForgotResult> {
  assertPlatformSmtpReady();

  const entry = await getAuthArtifact<PlatformPasswordResetPayload>(
    resetId,
    "platform_password_reset",
  );
  if (!entry) {
    throw new PlatformError("invalid_reset", "Password reset session expired or not found");
  }

  const code = generateOtpCode();
  const updated: PlatformPasswordResetPayload = {
    ...entry.payload,
    codeHash: hashOtpCode(code),
    attempts: 0,
  };
  await deleteAuthArtifact(resetId);
  await putAuthArtifact("platform_password_reset", updated, RESET_TTL_MS, resetId);

  try {
    const dispatch = await dispatchResetCode(entry.payload.email, code, resetId);
    assertResetEmailDeliverable(dispatch);
    return buildDevForgotResult(dispatch, resetId);
  } catch (error) {
    await deleteAuthArtifact(resetId);
    throw error;
  }
}

export async function completePlatformPasswordReset(
  resetId: string,
  code: string,
  password: string,
): Promise<StoredPlatformUser> {
  const entry = await getAuthArtifact<PlatformPasswordResetPayload>(
    resetId,
    "platform_password_reset",
  );
  if (!entry) {
    throw new PlatformError("invalid_reset", "Password reset session expired or not found");
  }

  const normalizedCode = code.replace(/\s/g, "");
  if (!verifyOtpCode(normalizedCode, entry.payload.codeHash)) {
    const attempts = (entry.payload.attempts ?? 0) + 1;
    if (attempts >= PLATFORM_OTP_MAX_ATTEMPTS) {
      await deleteAuthArtifact(resetId);
      throw new PlatformError(
        "too_many_attempts",
        "Too many invalid verification attempts. Request a new code.",
      );
    }
    await deleteAuthArtifact(resetId);
    await putAuthArtifact(
      "platform_password_reset",
      { ...entry.payload, attempts },
      RESET_TTL_MS,
      resetId,
    );
    throw new PlatformError("invalid_code", "Invalid verification code");
  }

  await deleteAuthArtifact(resetId);

  const passwordHash = await hashPassword(password);
  return updatePlatformUserPassword(entry.payload.userId, passwordHash);
}
