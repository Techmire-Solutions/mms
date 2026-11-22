import type { PlatformPasswordForgotResult, StoredPlatformUser } from "@mms/shared";
import {
  normalizePlatformEmail,
  PLATFORM_OTP_MAX_ATTEMPTS,
  PLATFORM_PASSWORD_RESET_TTL_MINUTES,
  resolvePlatformNotificationChannel,
} from "@mms/shared";
import {
  createArtifactId,
  deleteAuthArtifact,
  getAuthArtifact,
  putAuthArtifact,
} from "../auth/authArtifactService.js";
import { isDevCredentialLoggingEnabled } from "../../lib/devLogging.js";
import { hashPassword } from "../auth/passwordService.js";
import { isPlatformSmtpConfigured, resolvePlatformAppOrigin } from "./platformEmailService.js";
import { PlatformError, throwPlatformSmtpRequiredError } from "./platformErrorService.js";
import { dispatchPlatformOtpAcrossChannels } from "./platformOtpDispatch.js";
import { getPlatformSettings } from "./platformSettingsService.js";
import {
  findPlatformUserByEmail,
  getStoredPlatformUserById,
  updatePlatformUserPassword,
} from "./platformUserService.js";
import { buildDevForgotResult } from "./platformValidationService.js";
import {
  createOtpChallengeService,
  type OtpChallengePayload,
  type OtpDispatchResult,
} from "../auth/otpChallengeService.js";

const RESET_TTL_MS = PLATFORM_PASSWORD_RESET_TTL_MINUTES * 60 * 1000;

export interface PlatformPasswordResetPayload extends OtpChallengePayload {
  userId: string;
  email: string;
}

function buildResetUrl(resetId: string): string {
  const origin = resolvePlatformAppOrigin();
  return `${origin}/platform/forgot-password?resetId=${encodeURIComponent(resetId)}`;
}

async function dispatchResetCode(
  user: StoredPlatformUser,
  code: string,
  resetId: string,
): Promise<OtpDispatchResult> {
  return dispatchPlatformOtpAcrossChannels({
    email: user.email,
    phone: user.phone,
    code,
    ttlMinutes: PLATFORM_PASSWORD_RESET_TTL_MINUTES,
    logLabel: "Platform password reset code",
    smsBody: `Your MMS platform password reset code is ${code}. It expires in ${PLATFORM_PASSWORD_RESET_TTL_MINUTES} minutes.`,
    smsFailWarnMessage: "Platform password reset SMS dispatch failed",
    emailSubject: "Reset your MMS platform password",
    emailBodyLines: [
      "Use this verification code to reset your platform administrator password:",
      "",
      `Or open this link: ${buildResetUrl(resetId)}`,
    ],
  });
}

const resetOtps = createOtpChallengeService<StoredPlatformUser, PlatformPasswordResetPayload>({
  kind: "platform_password_reset",
  ttlMs: RESET_TTL_MS,
  maxAttempts: PLATFORM_OTP_MAX_ATTEMPTS,
  buildPayload: (user, codeHash) => ({ userId: user.id, email: user.email, codeHash, attempts: 0 }),
  persist: async (payload, id) => {
    const target = id ?? createArtifactId();
    await putAuthArtifact("platform_password_reset", payload, RESET_TTL_MS, target);
    return target;
  },
  loadForVerify: (resetId) =>
    getAuthArtifact<PlatformPasswordResetPayload>(resetId, "platform_password_reset"),
  loadForResend: (resetId) =>
    getAuthArtifact<PlatformPasswordResetPayload>(resetId, "platform_password_reset"),
  // The row was only read, not consumed — delete then re-put with the full TTL.
  rearm: async (entry, payload) => {
    await deleteAuthArtifact(entry.id);
    await putAuthArtifact("platform_password_reset", payload, RESET_TTL_MS, entry.id);
  },
  remove: (entry) => deleteAuthArtifact(entry.id),
  consumeOnSuccess: true,
  resolveUserForResend: async (entry) => {
    const user = await getStoredPlatformUserById(entry.payload.userId);
    if (!user || user.disabledAt) return null;
    return user;
  },
  dispatch: (user, code, resetId) => dispatchResetCode(user, code, resetId ?? ""),
});

function assertResetDeliverable(dispatch: OtpDispatchResult): void {
  if (dispatch.sent) return;
  if (isDevCredentialLoggingEnabled() && dispatch.devCode) return;
  throw new PlatformError(
    "email_send_failed",
    "Failed to send password reset code. Configure notification providers in Platform Settings.",
  );
}

function assertPlatformSmtpReady(): void {
  const channel = resolvePlatformNotificationChannel(getPlatformSettings());
  if (channel === "both" || channel === "email" || channel === "none") {
    if (process.env.NODE_ENV === "production" && !isPlatformSmtpConfigured()) {
      throwPlatformSmtpRequiredError();
    }
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

  const created = await resetOtps.createChallenge(user);
  try {
    const dispatch = await resetOtps.dispatch(user, created.code, created.challengeId);
    assertResetDeliverable(dispatch);
    return buildDevForgotResult(dispatch, created.challengeId);
  } catch (error) {
    await deleteAuthArtifact(created.challengeId);
    throw error;
  }
}

export async function resendPlatformPasswordReset(
  resetId: string,
): Promise<PlatformPasswordForgotResult> {
  assertPlatformSmtpReady();

  const regenerated = await resetOtps.regenerate(resetId);
  if (!regenerated.ok || !regenerated.user) {
    throw new PlatformError("invalid_reset", "Password reset session expired or not found");
  }

  try {
    const dispatch = await resetOtps.dispatch(regenerated.user, regenerated.code, resetId);
    assertResetDeliverable(dispatch);
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
  const outcome = await resetOtps.verify(resetId, code);
  if (!outcome.ok) {
    if (outcome.reason === "not_found") {
      throw new PlatformError("invalid_reset", "Password reset session expired or not found");
    }
    if (outcome.reason === "too_many_attempts") {
      throw new PlatformError(
        "too_many_attempts",
        "Too many invalid verification attempts. Request a new code.",
      );
    }
    throw new PlatformError("invalid_code", "Invalid verification code");
  }

  const passwordHash = await hashPassword(password);
  return updatePlatformUserPassword(outcome.payload.userId, passwordHash);
}
