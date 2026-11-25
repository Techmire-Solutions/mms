import { randomBytes } from "node:crypto";
import type { JWT } from "@fastify/jwt";
import type { User } from "@mms/contracts";
import {
  REFRESH_TOKEN_TTL_SECONDS,
  resolveNotificationChannel,
  TENANT_OTP_MAX_ATTEMPTS,
  TWO_FACTOR_CHALLENGE_TTL_MS,
} from "@mms/contracts";
import {
  authArtifactUserScopeKey,
  authArtifactWorkspaceScopeKey,
  consumeAuthArtifactWithPayload,
  createArtifactId,
  deleteAuthArtifact,
  findRefreshTokenByHash,
  getAuthArtifact,
  putAuthArtifact,
} from "./authArtifactService.js";
import {
  createOtpChallengeService,
  type OtpChallengePayload,
  type OtpDispatchResult,
} from "./otpChallengeService.js";
import { createRefreshTokenValue, hashRefreshToken } from "./authCookieService.js";
import { getPublicUserById } from "./userService.js";
import { loadGlobalSettings } from "../globalSettingsService.js";
import { sendTenantEmail } from "../email/emailService.js";
import { sendTenantSms } from "../sms/smsService.js";
import { getContactById } from "@mms/mod-contacts/backend/use-cases";
import { runWithTenant } from "../../lib/tenantContext.js";
import { logger } from "../../lib/logger.js";
import { isDevCredentialLoggingEnabled } from "@mms/be-core/logger/devLogging";

const CHALLENGE_TTL_MS = TWO_FACTOR_CHALLENGE_TTL_MS;
/** Refresh-token artifact lifetime mirrors the 7-day refresh cookie TTL. */
const REFRESH_TTL_MS = REFRESH_TOKEN_TTL_SECONDS * 1000;

export interface TwoFactorChallengePayload extends OtpChallengePayload {
  userId: string;
  email: string;
  /** Carried through so the SMS channel can resolve a phone via the linked contact. */
  contactId?: string | number;
  workspaceSubdomain: string;
}

export interface RefreshTokenPayload {
  userId: string;
  workspaceSubdomain: string;
  tokenHash: string;
}

function challengeMatchesTenant(
  payload: TwoFactorChallengePayload,
  expectedTenant: string,
): boolean {
  return payload.workspaceSubdomain.trim().toLowerCase() === expectedTenant.trim().toLowerCase();
}

const twoFactorChallenges = createOtpChallengeService<User, TwoFactorChallengePayload>({
  kind: "two_factor_challenge",
  ttlMs: CHALLENGE_TTL_MS,
  maxAttempts: TENANT_OTP_MAX_ATTEMPTS,
  buildPayload: (user, codeHash) => ({
    userId: user.id,
    email: user.email,
    contactId: user.contactId,
    workspaceSubdomain: user.workspaceSubdomain,
    codeHash,
    attempts: 0,
  }),
  persist: async (payload, id) => {
    const target = id ?? createArtifactId();
    await putAuthArtifact("two_factor_challenge", payload, CHALLENGE_TTL_MS, {
      id: target,
      scopeKey: authArtifactWorkspaceScopeKey(payload.workspaceSubdomain),
    });
    return target;
  },
  // Atomic claim: DELETE … RETURNING gives the challenge to exactly one caller,
  // so parallel guesses cannot all read the same code before it is deleted.
  loadForVerify: (challengeId) =>
    consumeAuthArtifactWithPayload<TwoFactorChallengePayload>(challengeId, "two_factor_challenge"),
  loadForResend: (challengeId) =>
    getAuthArtifact<TwoFactorChallengePayload>(challengeId, "two_factor_challenge"),
  // Re-arm the (single-use) challenge with the incremented counter for the time
  // the artifact had left; a consumed challenge past its expiry stays dead.
  rearm: async (entry, payload) => {
    const remainingMs = entry.expiresAt.getTime() - Date.now();
    if (remainingMs <= 0) return;
    await putAuthArtifact("two_factor_challenge", payload, remainingMs, {
      id: entry.id,
      scopeKey: authArtifactWorkspaceScopeKey(payload.workspaceSubdomain),
    });
  },
  remove: (entry) => deleteAuthArtifact(entry.id),
  resolveUserOnSuccess: async (payload) => {
    const user = await runWithTenant(payload.workspaceSubdomain, () =>
      getPublicUserById(payload.userId),
    );
    if (!user) return null;
    if (user.workspaceSubdomain !== payload.workspaceSubdomain) return null;
    return user;
  },
  dispatch: (user, code) => dispatchTwoFactorCode(user.email, user.contactId, code),
  dispatchOnResend: (_user, code, payload) =>
    dispatchTwoFactorCode(payload.email, payload.contactId, code),
});

export async function createTwoFactorChallenge(user: User): Promise<string> {
  const { challengeId } = await twoFactorChallenges.issue(user);
  return challengeId;
}

export async function resendTwoFactorChallenge(
  challengeId: string,
  expectedTenant: string,
): Promise<boolean> {
  // A challenge minted in workspace A must never be re-sent from workspace B's
  // host; without this binding the flow is a cross-workspace login CSRF vector.
  const outcome = await twoFactorChallenges.resend(challengeId, (payload) =>
    challengeMatchesTenant(payload, expectedTenant),
  );
  return outcome.ok;
}

export async function verifyTwoFactorChallenge(
  challengeId: string,
  code: string,
  expectedTenant: string,
): Promise<User | null> {
  const outcome = await twoFactorChallenges.verify(challengeId, code, (payload) =>
    challengeMatchesTenant(payload, expectedTenant),
  );
  return outcome.ok && outcome.user ? outcome.user : null;
}

async function dispatchTwoFactorCode(
  email: string,
  contactId: string | number | undefined,
  code: string,
): Promise<OtpDispatchResult> {
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

  return { sent: emailSent || smsSent };
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
    { ...user, twoFactorVerified: true, tokenType: "access", jti, iat_ms: Date.now() },
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
