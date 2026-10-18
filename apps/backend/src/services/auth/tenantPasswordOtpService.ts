import { randomBytes } from "node:crypto";
import type { FastifyReply } from "fastify";
import type { JWT } from "@fastify/jwt";
import {
  TENANT_PASSWORD_OTP_TTL_MINUTES,
  TENANT_OTP_MAX_ATTEMPTS,
  type ActivityLog,
} from "@mms/shared";
import {
  deleteAuthArtifact,
  findAuthArtifactByLookupKey,
  putAuthArtifact,
  updateAuthArtifactPayload,
} from "./authArtifactService.js";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "./authCookieService.js";
import { hashPassword } from "./passwordService.js";
import { assertPasswordMeetsPolicy } from "../globalSettingsService.js";
import { activateInvitedTenantUserRow } from "../../db/repositories/tenantUserRepository.js";
import { findUserByLoginEmailAndWorkspace, getPublicUserById } from "./userService.js";
import { establishSession, type AuthResult } from "./authService.js";
import { sendTenantEmail } from "../email/emailService.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { usersRepository } from "../../users/repository/usersRepositoryAdapter.js";
import { logger } from "../../lib/logger.js";

const OTP_TTL_MS = TENANT_PASSWORD_OTP_TTL_MINUTES * 60 * 1000;
const RESEND_COOLDOWN_MS = 60_000;

export interface TenantPasswordOtpPayload {
  userId: string;
  workspaceSubdomain: string;
  email: string;
  codeHash: string;
  attempts: number;
  createdAt: string;
}

export class TenantPasswordOtpError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: "invalid_code" | "too_many_attempts" | "not_found",
    message: string,
  ) {
    super(message);
    this.name = "TenantPasswordOtpError";
    this.statusCode = code === "not_found" ? 404 : 400;
  }
}

const WELCOME_EMAIL_FAILURE_MESSAGES: Record<string, string> = {
  notifications_disabled:
    "Email notifications are turned off in Settings → General → Notifications.",
  not_configured: "No outgoing mail server is configured in Settings → General → Notifications.",
};

function otpLookupKey(workspaceSubdomain: string, email: string): string {
  return `tenant-otp:${workspaceSubdomain.trim().toLowerCase()}:${email.trim().toLowerCase()}`;
}

async function recordPasswordSetActivity(tenant: string, userId: string): Promise<void> {
  const log: ActivityLog = {
    id: `log_${randomBytes(8).toString("hex")}`,
    userId,
    action: "update",
    module: "users",
    detail: "Set password and signed in",
    ts: new Date().toISOString(),
    ip: "127.0.0.1",
  };
  await usersRepository.bulkSaveActivityLogs(tenant, [log]);
  await broadcastCollection("user_activity_logs");
}

/**
 * Sends a plain, tokenless "welcome" link for a newly-created (invite-method) user.
 * The link carries no secret — it's a shortcut into the same OTP flow every user
 * already has (`?activate=1`). Never throws — reports `sent`.
 */
export async function sendTenantWelcomeEmail(input: {
  workspaceSubdomain: string;
  email: string;
  name: string;
  origin: string;
}): Promise<{ sent: boolean; error?: string }> {
  const link = `${input.origin.replace(/\/$/, "")}/forgot-password?activate=1`;
  const result = await sendTenantEmail({
    to: input.email,
    subject: `You're invited to join ${input.workspaceSubdomain} on MMS`,
    text: `Hi ${input.name},\n\nYou've been added as a user. Activate your account and set your password:\n${link}`,
    html: `<p>Hi ${input.name},</p><p>You've been added as a user. Activate your account and set your password:</p><p><a href="${link}">${link}</a></p>`,
  });

  if (!result.sent) {
    const error =
      result.message ||
      (result.reason && WELCOME_EMAIL_FAILURE_MESSAGES[result.reason]) ||
      "The welcome email could not be sent.";
    logger.warn(
      { email: input.email, reason: result.reason, error },
      "Tenant welcome email failed to send",
    );
    if (process.env.NODE_ENV !== "production") {
      logger.info({ email: input.email, link }, "Tenant welcome link (dev, email not sent)");
    }
    return { sent: false, error };
  }

  return { sent: true };
}

/**
 * Step 1 — request a one-time code. Used for both a brand-new user's first
 * activation and any existing user's forgot-password; the caller distinguishes
 * only via UI copy. Never reveals whether the email matched an account.
 */
export async function requestTenantPasswordReset(input: {
  email: string;
  workspaceSubdomain: string;
}): Promise<{ accepted: true }> {
  const email = input.email.trim().toLowerCase();
  const lookupKey = otpLookupKey(input.workspaceSubdomain, email);

  const user = await findUserByLoginEmailAndWorkspace(email, input.workspaceSubdomain);
  if (!user) {
    return { accepted: true };
  }

  const existing = await findAuthArtifactByLookupKey<TenantPasswordOtpPayload>(
    "tenant_password_otp",
    lookupKey,
  );
  if (existing) {
    const elapsed = Date.now() - new Date(existing.payload.createdAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      return { accepted: true };
    }
    await deleteAuthArtifact(existing.id);
  }

  const code = generateOtpCode();
  await putAuthArtifact<TenantPasswordOtpPayload>(
    "tenant_password_otp",
    {
      userId: user.id,
      workspaceSubdomain: input.workspaceSubdomain,
      email,
      codeHash: hashOtpCode(code),
      attempts: 0,
      createdAt: new Date().toISOString(),
    },
    OTP_TTL_MS,
    { lookupKey },
  );

  const dispatch = await sendTenantEmail({
    to: email,
    subject: "Your MMS verification code",
    text: `Your verification code is ${code}. It expires in ${TENANT_PASSWORD_OTP_TTL_MINUTES} minutes.\n\nIf you didn't request this, you can ignore this email.`,
    html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in ${TENANT_PASSWORD_OTP_TTL_MINUTES} minutes.</p><p>If you didn't request this, you can ignore this email.</p>`,
  });

  if (!dispatch.sent && process.env.NODE_ENV !== "production") {
    logger.info({ email, code }, "Tenant password OTP (dev, email not sent)");
  }

  return { accepted: true };
}

/** Step 2 — verify the code before the UI shows the new-password fields. Does not consume. */
export async function verifyTenantPasswordResetOtp(input: {
  email: string;
  workspaceSubdomain: string;
  code: string;
}): Promise<{ ok: true }> {
  const email = input.email.trim().toLowerCase();
  const lookupKey = otpLookupKey(input.workspaceSubdomain, email);
  const entry = await findAuthArtifactByLookupKey<TenantPasswordOtpPayload>(
    "tenant_password_otp",
    lookupKey,
  );
  if (!entry) {
    throw new TenantPasswordOtpError("invalid_code", "Invalid or expired code");
  }

  const normalizedCode = input.code.replace(/\s/g, "");
  if (!verifyOtpCode(normalizedCode, entry.payload.codeHash)) {
    const attempts = entry.payload.attempts + 1;
    if (attempts >= TENANT_OTP_MAX_ATTEMPTS) {
      await deleteAuthArtifact(entry.id);
      throw new TenantPasswordOtpError(
        "too_many_attempts",
        "Too many invalid attempts. Request a new code.",
      );
    }
    await updateAuthArtifactPayload(entry.id, { ...entry.payload, attempts });
    throw new TenantPasswordOtpError("invalid_code", "Invalid or expired code");
  }

  return { ok: true };
}

/** Step 3 — re-validates the code, consumes it, sets the password, and signs the user in. */
export async function resetTenantPassword(input: {
  email: string;
  workspaceSubdomain: string;
  code: string;
  password: string;
  jwtSigner: JWT;
  reply: FastifyReply;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const lookupKey = otpLookupKey(input.workspaceSubdomain, email);
  const entry = await findAuthArtifactByLookupKey<TenantPasswordOtpPayload>(
    "tenant_password_otp",
    lookupKey,
  );
  if (!entry) {
    throw new TenantPasswordOtpError("invalid_code", "Invalid or expired code");
  }

  const normalizedCode = input.code.replace(/\s/g, "");
  if (!verifyOtpCode(normalizedCode, entry.payload.codeHash)) {
    throw new TenantPasswordOtpError("invalid_code", "Invalid or expired code");
  }

  // Validate before consuming — a policy-rejected password must not burn the one-shot code.
  await assertPasswordMeetsPolicy(input.password);
  const passwordHash = await hashPassword(input.password);

  await deleteAuthArtifact(entry.id);

  const activated = await activateInvitedTenantUserRow(
    entry.payload.workspaceSubdomain,
    entry.payload.userId,
    passwordHash,
  );
  if (!activated) {
    throw new TenantPasswordOtpError("not_found", "This account is no longer available");
  }

  const user = await getPublicUserById(entry.payload.userId);
  if (!user) {
    throw new TenantPasswordOtpError("not_found", "This account is no longer available");
  }

  await recordPasswordSetActivity(entry.payload.workspaceSubdomain, entry.payload.userId);
  await broadcastCollection("users");

  return establishSession(user, input.jwtSigner, input.reply, true);
}
