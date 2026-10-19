import { randomBytes } from "node:crypto";
import type { JWT } from "@fastify/jwt";
import type { User } from "@mms/shared";
import { resolveNotificationChannel } from "@mms/shared";
import {
  authArtifactUserScopeKey,
  authArtifactWorkspaceScopeKey,
  createArtifactId,
  deleteAuthArtifact,
  findRefreshTokenByHash,
  getAuthArtifact,
  putAuthArtifact,
  takeAuthArtifact,
} from "./authArtifactService.js";
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpCode,
  createRefreshTokenValue,
  hashRefreshToken,
} from "./authCookieService.js";
import { getPublicUserById } from "./userService.js";
import { loadGlobalSettings } from "../globalSettingsService.js";
import { sendTenantEmail } from "../email/emailService.js";
import { sendTenantSms } from "../sms/smsService.js";
import { getContactById } from "../../contacts/use-cases/contactLoadUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { logger } from "../../lib/logger.js";
import { isDevCredentialLoggingEnabled } from "../../lib/devLogging.js";

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface TwoFactorChallengePayload {
  userId: string;
  email: string;
  /** Carried through so the SMS channel can resolve a phone via the linked contact. */
  contactId?: string | number;
  workspaceSubdomain: string;
  codeHash: string;
}

export interface RefreshTokenPayload {
  userId: string;
  workspaceSubdomain: string;
  tokenHash: string;
}

export async function createTwoFactorChallenge(user: User): Promise<string> {
  const code = generateOtpCode();
  const challengeId = createArtifactId();
  await putAuthArtifact<TwoFactorChallengePayload>(
    "two_factor_challenge",
    {
      userId: user.id,
      email: user.email,
      contactId: user.contactId,
      workspaceSubdomain: user.workspaceSubdomain,
      codeHash: hashOtpCode(code),
    },
    CHALLENGE_TTL_MS,
    {
      id: challengeId,
      scopeKey: authArtifactWorkspaceScopeKey(user.workspaceSubdomain),
    },
  );
  await dispatchTwoFactorCode(user.email, user.contactId, code);
  return challengeId;
}

export async function resendTwoFactorChallenge(challengeId: string): Promise<boolean> {
  const entry = await getAuthArtifact<TwoFactorChallengePayload>(
    challengeId,
    "two_factor_challenge",
  );
  if (!entry) return false;

  const code = generateOtpCode();
  entry.payload.codeHash = hashOtpCode(code);
  await deleteAuthArtifact(challengeId);
  await putAuthArtifact("two_factor_challenge", entry.payload, CHALLENGE_TTL_MS, {
    id: challengeId,
    scopeKey: authArtifactWorkspaceScopeKey(entry.payload.workspaceSubdomain),
  });
  await dispatchTwoFactorCode(entry.payload.email, entry.payload.contactId, code);
  return true;
}

export async function verifyTwoFactorChallenge(
  challengeId: string,
  code: string,
): Promise<User | null> {
  const entry = await takeAuthArtifact<TwoFactorChallengePayload>(
    challengeId,
    "two_factor_challenge",
  );
  if (!entry) return null;
  if (!verifyOtpCode(code.replace(/\s/g, ""), entry.payload.codeHash)) return null;

  const user = await runWithTenant(entry.payload.workspaceSubdomain, () =>
    getPublicUserById(entry.payload.userId),
  );
  if (!user) return null;
  if (user.workspaceSubdomain !== entry.payload.workspaceSubdomain) return null;
  return user;
}

async function dispatchTwoFactorCode(
  email: string,
  contactId: string | number | undefined,
  code: string,
): Promise<void> {
  const settings = await loadGlobalSettings();
  const channel = resolveNotificationChannel(settings);
  const text = `Your MMS verification code is ${code}. It expires in 10 minutes.`;

  let emailSent = false;
  let smsSent = false;

  if (channel === "both" || channel === "email") {
    const emailResult = await sendTenantEmail({
      to: email,
      subject: "MMS verification code",
      text,
    });
    emailSent = Boolean(emailResult.sent);
  }

  if (channel === "both" || channel === "sms") {
    // Users have no phone field of their own — resolve it via the linked contact
    // (Contacts Canonical: profile fields, including phone, live on the contact).
    const contact = contactId != null ? await getContactById(String(contactId)) : null;
    if (contact?.phone) {
      const result = await sendTenantSms({ to: contact.phone, body: text }, settings);
      smsSent = Boolean(result.sent);
      if (!result.sent) {
        logger.warn({ channel, reason: result.reason }, "2FA SMS dispatch failed");
      }
    } else {
      logger.warn({ channel }, "2FA SMS channel active but the admin has no phone number on file");
    }
  }

  // Never log a live credential by default: the log stream is shipped, indexed
  // and retained. Local development can opt in with MMS_LOG_DEV_CREDENTIALS=true;
  // the code is also filtered out by lib/logRedaction.ts as a backstop.
  if (!emailSent && !smsSent) {
    if (isDevCredentialLoggingEnabled()) {
      logger.info({ channel, code }, "2FA code generated (dev credential logging enabled)");
    } else {
      logger.info({ channel }, "2FA code generated");
    }
  }
}

export async function issueRefreshToken(user: User): Promise<string> {
  const refreshToken = createRefreshTokenValue();
  const tokenHash = hashRefreshToken(refreshToken);
  await putAuthArtifact<RefreshTokenPayload>(
    "refresh_token",
    {
      userId: user.id,
      workspaceSubdomain: user.workspaceSubdomain,
      tokenHash,
    },
    REFRESH_TTL_MS,
    {
      id: randomBytes(16).toString("hex"),
      lookupKey: tokenHash,
      scopeKey: authArtifactUserScopeKey(user.id),
    },
  );
  return refreshToken;
}

export async function rotateRefreshToken(
  _presentedToken: string,
  user: User,
  jwtSigner: JWT,
  accessExpiresIn: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  // Rotation: issue new pair; old refresh artifact was deleted by the caller.
  const refreshToken = await issueRefreshToken(user);

  const jti = randomBytes(16).toString("hex");
  const accessToken = jwtSigner.sign(
    { ...user, twoFactorVerified: true, tokenType: "access", jti },
    { expiresIn: accessExpiresIn },
  );

  return { accessToken, refreshToken };
}

export async function validateRefreshToken(
  presentedToken: string,
  workspaceSubdomain: string,
): Promise<{ payload: RefreshTokenPayload; artifactId: string } | null> {
  if (!presentedToken) return null;

  const record = await findRefreshTokenByHash<RefreshTokenPayload>(
    hashRefreshToken(presentedToken),
  );
  if (!record) return null;
  if (record.payload.workspaceSubdomain.toLowerCase() !== workspaceSubdomain.toLowerCase()) {
    return null;
  }

  return { payload: record.payload, artifactId: record.id };
}
