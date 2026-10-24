import { generateOtpCode, hashOtpCode, verifyOtpCode } from "./authCookieService.js";
import {
  createArtifactId,
  deleteRefreshTokensForUser,
  putAuthArtifact,
  takeAuthArtifact,
} from "./authArtifactService.js";
import {
  getPublicUserById,
  setPendingLoginEmail,
  setTenantLoginEmail,
  verifyUserPassword,
} from "./userService.js";
import { sendTenantEmail } from "../email/emailService.js";
import { logger } from "../../lib/logger.js";
import { isDevCredentialLoggingEnabled, maskEmail } from "../../lib/devLogging.js";

const CHANGE_TTL_MS = 15 * 60 * 1000;

export interface LoginEmailChangePayload {
  userId: string;
  workspaceSubdomain: string;
  newLoginEmail: string;
  previousLoginEmail: string;
  codeHash: string;
}

export class LoginEmailChangeError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code:
      "invalid_credentials" | "invalid_code" | "not_found" | "conflict" | "email_send_failed",
    message: string,
  ) {
    super(message);
    this.name = "LoginEmailChangeError";

    const statuses: Record<
      "invalid_credentials" | "invalid_code" | "not_found" | "conflict" | "email_send_failed",
      number
    > = {
      invalid_credentials: 401,
      invalid_code: 401,
      not_found: 404,
      conflict: 409,
      email_send_failed: 503,
    };
    this.statusCode = statuses[code] ?? 400;
  }
}

async function dispatchChangeCode(
  email: string,
  code: string,
): Promise<{ sent: boolean; devCode?: string }> {
  const result = await sendTenantEmail({
    to: email,
    subject: "Confirm your new sign-in email",
    text: `Your verification code is: ${code}\n\nThis code expires in 15 minutes.`,
    html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`,
  });
  if (result.sent) return { sent: true };
  // Only ever hand back a live OTP under the explicit local-dev gate
  // (development/test + MMS_LOG_DEV_CREDENTIALS=true). `!== 'production'` was
  // too weak — a staging box with NODE_ENV unset would leak a usable code.
  if (isDevCredentialLoggingEnabled()) {
    logger.info(
      { email: maskEmail(email), code },
      "Login email change code generated (dev credential logging enabled)",
    );
    return { sent: false, devCode: code };
  }
  throw new LoginEmailChangeError("email_send_failed", "Failed to send verification email");
}

export async function requestLoginEmailChange(
  userId: string,
  newLoginEmail: string,
  currentPassword: string,
): Promise<{ challengeId: string; devCode?: string }> {
  const user = await getPublicUserById(userId);
  if (!user) {
    throw new LoginEmailChangeError("not_found", "User not found");
  }

  const validPassword = await verifyUserPassword(userId, currentPassword);
  if (!validPassword) {
    throw new LoginEmailChangeError("invalid_credentials", "Current password is incorrect");
  }

  const normalized = newLoginEmail.trim().toLowerCase();
  if (normalized === (user.loginEmail ?? user.email).toLowerCase()) {
    throw new LoginEmailChangeError("conflict", "New email must differ from current login email");
  }

  const code = generateOtpCode();
  const challengeId = createArtifactId();
  await putAuthArtifact<LoginEmailChangePayload>(
    "login_email_change",
    {
      userId,
      workspaceSubdomain: user.workspaceSubdomain,
      newLoginEmail: normalized,
      previousLoginEmail: user.loginEmail ?? user.email,
      codeHash: hashOtpCode(code),
    },
    CHANGE_TTL_MS,
    challengeId,
  );
  await setPendingLoginEmail(userId, normalized);

  const dispatch = await dispatchChangeCode(normalized, code);
  return { challengeId, devCode: dispatch.devCode };
}

export async function confirmLoginEmailChange(
  challengeId: string,
  code: string,
): Promise<Awaited<ReturnType<typeof setTenantLoginEmail>>> {
  const entry = await takeAuthArtifact<LoginEmailChangePayload>(challengeId, "login_email_change");
  if (!entry) {
    throw new LoginEmailChangeError("invalid_code", "Invalid or expired verification code");
  }

  if (!verifyOtpCode(code.replace(/\s/g, ""), entry.payload.codeHash)) {
    throw new LoginEmailChangeError("invalid_code", "Invalid or expired verification code");
  }

  try {
    const updated = await setTenantLoginEmail(entry.payload.userId, entry.payload.newLoginEmail);
    await deleteRefreshTokensForUser(entry.payload.userId);
    return updated;
  } catch (error: unknown) {
    const err = error as Error & { type?: string };
    if (err.type === "conflict") {
      throw new LoginEmailChangeError("conflict", err.message);
    }
    throw error;
  } finally {
    await setPendingLoginEmail(entry.payload.userId, undefined);
  }
}
