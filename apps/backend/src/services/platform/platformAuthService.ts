import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import type { JWT } from "@fastify/jwt";
import type { PlatformUser, PlatformUserProfile } from "@mms/shared";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "../auth/passwordService.js";
import { clearAuthCookies, setCsrfCookie } from "../auth/authCookieService.js";
import {
  findPlatformUserByEmail,
  toPlatformUserProfile,
  toPublicPlatformUser,
} from "./platformUserService.js";
import { clearPlatformAccessCookie, setPlatformAccessCookie } from "./platformCookieService.js";
import {
  createPlatformTwoFactorChallenge,
  isPlatformTwoFactorRequired,
} from "./platformTwoFactorService.js";
import { platformSessionScope, resetSessionClock } from "../sessionClockService.js";
import { platformSessionPolicy } from "../sessionPolicyService.js";

const PLATFORM_ACCESS_TTL = "8h";

/** Minimal JWT claims for platform access cookies. */
export interface PlatformAccessTokenPayload {
  id: string;
  tokenType: "platform_access";
  sessionVersion?: number;
  jti?: string;
}

export type PlatformLoginFailure =
  "invalid_credentials" | "account_disabled" | "two_factor_unavailable";

export type PlatformLoginResult =
  | { ok: true; user: PlatformUserProfile; requires2FA?: boolean; challengeId?: string }
  | { ok: false; type: PlatformLoginFailure };

export async function issuePlatformSession(
  user: PlatformUser,
  jwtSigner: JWT,
  reply: FastifyReply,
  sessionVersion = 0,
): Promise<PlatformUser> {
  clearAuthCookies(reply);
  // Re-issue CSRF after clearing tenant cookies so platform mutations keep
  // double-submit protection (Origin alone is not sufficient parity).
  setCsrfCookie(reply);

  // Minimal claims only — role/permissions reload from DB on each authenticatePlatform.
  const accessToken = jwtSigner.sign(
    {
      id: user.id,
      tokenType: "platform_access",
      sessionVersion,
      jti: randomUUID(),
    } satisfies PlatformAccessTokenPayload,
    { expiresIn: PLATFORM_ACCESS_TTL },
  );
  setPlatformAccessCookie(reply, accessToken);

  const { idleMs } = platformSessionPolicy();
  await resetSessionClock(platformSessionScope(user.id), idleMs);

  return user;
}

export async function loginPlatformUser(
  email: string,
  password: string,
  jwtSigner: JWT,
  reply: FastifyReply,
): Promise<PlatformLoginResult> {
  const stored = await findPlatformUserByEmail(email);

  const passwordOk = stored
    ? await verifyPassword(password, stored.passwordHash)
    : await verifyPassword(password, DUMMY_PASSWORD_HASH).then(() => false);

  if (!stored || !passwordOk) {
    return { ok: false, type: "invalid_credentials" };
  }

  if (stored.disabledAt) {
    return { ok: false, type: "account_disabled" };
  }

  // Optional 2FA step (opt-in via PLATFORM_REQUIRE_2FA=true). When enabled, the
  // session is only issued after the OTP is verified. If the code cannot be
  // delivered, fail closed rather than bypassing 2FA.
  if (isPlatformTwoFactorRequired()) {
    const challengeId = await createPlatformTwoFactorChallenge(stored);
    if (!challengeId) {
      return { ok: false, type: "two_factor_unavailable" };
    }
    return { ok: true, user: toPlatformUserProfile(stored), requires2FA: true, challengeId };
  }

  await issuePlatformSession(toPublicPlatformUser(stored), jwtSigner, reply, stored.sessionVersion);
  return { ok: true, user: toPlatformUserProfile(stored) };
}

export function logoutPlatformUser(reply: FastifyReply): void {
  clearPlatformAccessCookie(reply);
  clearAuthCookies(reply);
}
