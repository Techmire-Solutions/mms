import type { FastifyReply } from "fastify";
import type { JWT } from "@fastify/jwt";
import type { NotificationChannel, PlatformUser, PlatformUserProfile } from "@mms/contracts";
import {
  PLATFORM_ACCESS_TOKEN_TTL_SECONDS,
  resolvePlatformNotificationChannel,
} from "@mms/contracts";
import { verifyPassword, platformPort } from "../deps.js";
import { clearAuthCookies, setCsrfCookie } from "../deps.js";
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
import { platformSessionScope } from "../deps.js";
import { platformSessionPolicy } from "../deps.js";
import { establishSessionShared } from "../deps.js";
import { getPlatformSettings } from "./platformSettingsService.js";

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
  | {
      ok: true;
      user: PlatformUserProfile;
      requires2FA?: boolean;
      challengeId?: string;
      channel?: NotificationChannel;
    }
  | { ok: false; type: PlatformLoginFailure };

export async function issuePlatformSession(
  user: PlatformUser,
  jwtSigner: JWT,
  reply: FastifyReply,
  sessionVersion = 0,
): Promise<PlatformUser> {
  await establishSessionShared({
    domain: "platform",
    jwtSigner,
    reply,
    // Minimal claims only — role/permissions reload from DB on each authenticatePlatform.
    claims: {
      id: user.id,
      tokenType: "platform_access",
      sessionVersion,
    } satisfies PlatformAccessTokenPayload,
    // Canonical 8-hour platform token TTL (formerly spelled "8h" here and
    // `8*60*60+300` at the logout revocation site — same TTL, plus grace there).
    expiresIn: PLATFORM_ACCESS_TOKEN_TTL_SECONDS,
    clearOtherDomainCookies: () => {
      clearAuthCookies(reply);
      // Re-issue CSRF after clearing tenant cookies so platform mutations keep
      // double-submit protection (Origin alone is not sufficient parity).
      setCsrfCookie(reply);
    },
    setDomainCookies: (accessToken: any) => setPlatformAccessCookie(reply, accessToken),
    sessionScope: platformSessionScope(user.id),
    idleMs: platformSessionPolicy().idleMs,
  });

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
    : await verifyPassword(password, platformPort<string>("DUMMY_PASSWORD_HASH")).then(() => false);

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
    const channel = resolvePlatformNotificationChannel(getPlatformSettings());
    return {
      ok: true,
      user: toPlatformUserProfile(stored),
      requires2FA: true,
      challengeId,
      channel,
    };
  }

  await issuePlatformSession(toPublicPlatformUser(stored), jwtSigner, reply, stored.sessionVersion);
  return { ok: true, user: toPlatformUserProfile(stored) };
}

export function logoutPlatformUser(reply: FastifyReply): void {
  clearPlatformAccessCookie(reply);
  clearAuthCookies(reply);
}
